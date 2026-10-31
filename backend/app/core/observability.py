"""Request metadata only: never log bodies, queries, identities or tokens."""

import json
import logging
import time
from datetime import UTC, datetime
from uuid import uuid4

from starlette.requests import Request
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.errors import unexpected_error_handler

logger = logging.getLogger("fisiomove.http")


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry: dict[str, object] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "event": record.getMessage(),
        }
        for field in (
            "request_id",
            "method",
            "route",
            "status",
            "duration_ms",
            "error_type",
        ):
            if hasattr(record, field):
                entry[field] = getattr(record, field)
        return json.dumps(entry, ensure_ascii=True, allow_nan=False)


def configure_logging() -> None:
    target = logging.getLogger("fisiomove")
    if not target.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(JsonFormatter())
        target.addHandler(handler)
        target.setLevel(logging.INFO)
        target.propagate = False


class RequestMetadataMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        request_id = uuid4().hex  # Do not trust externally supplied log identifiers.
        scope.setdefault("state", {})["request_id"] = request_id
        started = time.perf_counter()
        status = 500
        response_started = False

        async def send_metadata(message: Message) -> None:
            nonlocal status, response_started
            if message["type"] == "http.response.start":
                status = message["status"]
                response_started = True
                headers = [
                    (key, value)
                    for key, value in message.get("headers", [])
                    if key.lower()
                    not in {
                        b"x-request-id",
                        b"cache-control",
                        b"x-content-type-options",
                    }
                ]
                headers.extend(
                    [
                        (b"x-request-id", request_id.encode()),
                        (b"x-content-type-options", b"nosniff"),
                        (b"cache-control", b"no-store"),
                    ]
                )
                message = {**message, "headers": headers}
            await send(message)

        try:
            await self.app(scope, receive, send_metadata)
        except Exception as exc:
            if response_started:
                status = 500
                logger.error(
                    "response_interrupted",
                    extra={"request_id": request_id, "error_type": type(exc).__name__},
                )
                # Do not allow Uvicorn to print raw exception messages/SQL parameters.
                raise RuntimeError(
                    f"Response interrupted; request_id={request_id}"
                ) from None
            response = await unexpected_error_handler(Request(scope), exc)
            await response(scope, receive, send_metadata)
        finally:
            route = scope.get("route")
            logger.info(
                "http_request",
                extra={
                    "request_id": request_id,
                    "method": scope["method"],
                    "route": getattr(route, "path", "<unmatched>"),
                    "status": status,
                    "duration_ms": round((time.perf_counter() - started) * 1000, 2),
                },
            )
