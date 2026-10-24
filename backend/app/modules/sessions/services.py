import hashlib
import json
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy.sql import Select

from app.core.errors import ApiError
from app.modules.achievements.services import AchievementService
from app.modules.auth.models import User, UserRole
from app.modules.patients.authorization import get_authorized_patient
from app.modules.patients.models import Patient
from app.modules.sessions.models import SessionResult
from app.modules.sessions.schemas import (
    SessionPage,
    SessionResultCreate,
    SessionResultResponse,
    SessionSummary,
)
from app.modules.workouts.services import WorkoutService


def _idempotency_conflict() -> None:
    raise ApiError(
        status_code=409,
        code="idempotency_conflict",
        message="The client_session_id was already used with different content.",
        details={"field": "client_session_id"},
    )


def _session_not_found() -> None:
    raise ApiError(
        status_code=404,
        code="session_not_found",
        message="The session was not found.",
    )


def _normalize_period(value: datetime | None, field: str) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None or value.utcoffset() is None:
        raise ApiError(
            status_code=422,
            code="invalid_datetime",
            message=f"{field} must include a timezone.",
        )
    return value.astimezone(UTC)


def _json_hash(payload: SessionResultCreate) -> str:
    canonical = json.dumps(
        payload.model_dump(mode="json"), sort_keys=True, separators=(",", ":")
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class SessionService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def own_patient(self, user: User) -> Patient:
        patient = self.session.scalar(
            select(Patient).where(
                Patient.user_id == user.id, Patient.is_active.is_(True)
            )
        )
        if patient is None:
            raise ApiError(
                status_code=404,
                code="patient_not_found",
                message="The patient was not found.",
            )
        return patient

    def authorize_patient(self, user: User, patient_id: UUID) -> Patient:
        if user.role == UserRole.PHYSIOTHERAPIST:
            return get_authorized_patient(self.session, user.id, patient_id)
        patient = self.session.scalar(
            select(Patient).where(
                Patient.id == patient_id,
                Patient.user_id == user.id,
                Patient.is_active.is_(True),
            )
        )
        if patient is None:
            raise ApiError(
                status_code=404,
                code="patient_not_found",
                message="The patient was not found.",
            )
        return patient

    @staticmethod
    def response(value: SessionResult) -> SessionResultResponse:
        completed_repetitions = sum(
            int(item["completed_repetitions"]) for item in value.items
        )
        return SessionResultResponse(
            id=value.id,
            client_session_id=value.client_session_id,
            patient_id=value.patient_id,
            workout_id=value.workout_id,
            workout_revision_id=value.workout_revision_id,
            status=value.status,
            started_at=value.started_at,
            finished_at=value.finished_at,
            active_duration_ms=value.active_duration_ms,
            completed_repetitions=completed_repetitions,
            low_confidence_summary=value.low_confidence_summary,
            feedback_summary=value.feedback_summary,
            workout_snapshot=value.workout_snapshot,
            items=value.items,
            created_at=value.created_at,
        )

    def create(self, user: User, payload: SessionResultCreate) -> SessionResultResponse:
        patient = self.own_patient(user)
        digest = _json_hash(payload)
        existing = self.session.scalar(
            select(SessionResult).where(
                SessionResult.patient_id == patient.id,
                SessionResult.client_session_id == payload.client_session_id,
            )
        )
        if existing is not None:
            if existing.payload_hash != digest:
                _idempotency_conflict()
            AchievementService(self.session).award_session_goal(existing)
            return self.response(existing)

        snapshot = WorkoutService(self.session).published_snapshot(
            user,
            payload.workout_id,
            payload.workout_revision_id,
            session_started_at=payload.started_at,
        )
        prescribed = {UUID(item["id"]): item for item in snapshot["items"]}
        results: list[dict[str, Any]] = []
        by_id = {item.workout_item_id: item for item in payload.items}
        total_item_duration = 0
        for result in payload.items:
            plan = prescribed.get(result.workout_item_id)
            if plan is None or result.position != plan["position"]:
                raise ApiError(
                    status_code=422,
                    code="session_item_invalid",
                    message="A session item does not belong to the selected revision.",
                )
            max_repetitions = int(plan["sets"]) * int(plan["repetitions"])
            if (
                result.completed_sets > int(plan["sets"])
                or result.completed_repetitions > max_repetitions
            ):
                raise ApiError(
                    status_code=422,
                    code="session_result_exceeds_plan",
                    message="Session results cannot exceed the published prescription.",
                )
            total_item_duration += result.active_duration_ms
            results.append(result.model_dump(mode="json"))

        if total_item_duration > payload.active_duration_ms:
            raise ApiError(
                status_code=422,
                code="session_item_duration_exceeds_total",
                message="Item durations cannot exceed the session active duration.",
            )
        if payload.status == "completed" and (
            len(by_id) != len(prescribed)
            or any(
                by_id[item_id].completed_sets != int(plan["sets"])
                or by_id[item_id].completed_repetitions
                != int(plan["sets"]) * int(plan["repetitions"])
                for item_id, plan in prescribed.items()
            )
        ):
            raise ApiError(
                status_code=422,
                code="completed_session_incomplete",
                message="A completed session must include the full prescribed results.",
            )

        record = SessionResult(
            client_session_id=payload.client_session_id,
            patient_id=patient.id,
            workout_id=payload.workout_id,
            workout_revision_id=payload.workout_revision_id,
            status=payload.status,
            started_at=payload.started_at,
            finished_at=payload.finished_at,
            active_duration_ms=payload.active_duration_ms,
            low_confidence_summary=payload.low_confidence_summary,
            feedback_summary=payload.feedback_summary,
            workout_snapshot=snapshot,
            items=results,
            payload_hash=digest,
        )
        try:
            with self.session.begin_nested():
                self.session.add(record)
                self.session.flush()
        except IntegrityError:
            existing = self.session.scalar(
                select(SessionResult).where(
                    SessionResult.patient_id == patient.id,
                    SessionResult.client_session_id == payload.client_session_id,
                )
            )
            if existing is None:
                raise
            if existing.payload_hash != digest:
                _idempotency_conflict()
            AchievementService(self.session).award_session_goal(existing)
            return self.response(existing)
        AchievementService(self.session).award_session_goal(record)
        return self.response(record)

    @staticmethod
    def summary(value: SessionResult) -> SessionSummary:
        prescribed = sum(
            int(item["sets"]) * int(item["repetitions"])
            for item in value.workout_snapshot["items"]
        )
        performed = sum(int(item["completed_repetitions"]) for item in value.items)
        return SessionSummary(
            id=value.id,
            patient_id=value.patient_id,
            workout_id=value.workout_id,
            workout_revision_id=value.workout_revision_id,
            status=value.status,
            started_at=value.started_at,
            finished_at=value.finished_at,
            active_duration_ms=value.active_duration_ms,
            prescribed_repetitions=prescribed,
            performed_repetitions=performed,
        )

    def _filtered_query(
        self,
        patient_id: UUID,
        period_start: datetime | None,
        period_end: datetime | None,
    ) -> Select[tuple[SessionResult]]:
        start = _normalize_period(period_start, "period_start")
        end = _normalize_period(period_end, "period_end")
        if start is not None and end is not None and end < start:
            raise ApiError(
                status_code=422,
                code="invalid_period",
                message="period_end must be on or after period_start.",
            )
        query = select(SessionResult).where(SessionResult.patient_id == patient_id)
        if start is not None:
            query = query.where(SessionResult.started_at >= start)
        if end is not None:
            query = query.where(SessionResult.started_at <= end)
        return query

    def list(
        self,
        user: User,
        patient_id: UUID,
        page: int,
        page_size: int,
        period_start: datetime | None,
        period_end: datetime | None,
    ) -> SessionPage:
        self.authorize_patient(user, patient_id)
        query = self._filtered_query(patient_id, period_start, period_end)
        total = (
            self.session.scalar(select(func.count()).select_from(query.subquery())) or 0
        )
        records = self.session.scalars(
            query.order_by(SessionResult.started_at.desc(), SessionResult.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return SessionPage(
            items=[self.summary(record) for record in records],
            page=page,
            page_size=page_size,
            total=total,
            pages=(total + page_size - 1) // page_size,
        )

    def get(self, user: User, session_id: UUID) -> SessionResultResponse:
        result = self.session.get(SessionResult, session_id)
        if result is None:
            _session_not_found()
        self.authorize_patient(user, result.patient_id)
        return self.response(result)

    def get_for_patient(
        self, user: User, patient_id: UUID, session_id: UUID
    ) -> SessionResultResponse:
        self.authorize_patient(user, patient_id)
        result = self.session.scalar(
            select(SessionResult).where(
                SessionResult.id == session_id,
                SessionResult.patient_id == patient_id,
            )
        )
        if result is None:
            _session_not_found()
        return self.response(result)

    def records(
        self,
        user: User,
        patient_id: UUID,
        period_start: datetime,
        period_end: datetime,
    ) -> list[SessionResult]:
        self.authorize_patient(user, patient_id)
        query = self._filtered_query(patient_id, period_start, period_end)
        return list(
            self.session.scalars(
                query.order_by(SessionResult.started_at, SessionResult.id)
            )
        )
