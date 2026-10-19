from collections.abc import Mapping, Sequence
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel


class ErrorResponse(BaseModel):
    code: str
    message: str
    details: Mapping[str, Any] | Sequence[Mapping[str, Any]] | None = None


class ApiError(Exception):
    """Expected API failure represented by the public error contract."""

    def __init__(
        self,
        *,
        status_code: int,
        code: str,
        message: str,
        details: Mapping[str, Any] | Sequence[Mapping[str, Any]] | None = None,
        headers: Mapping[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.error = ErrorResponse(code=code, message=message, details=details)
        self.headers = headers


def _response(
    status_code: int,
    error: ErrorResponse,
    headers: Mapping[str, str] | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=error.model_dump(),
        headers=headers,
    )


async def api_error_handler(_: Request, exc: ApiError) -> JSONResponse:
    return _response(exc.status_code, exc.error, exc.headers)


async def validation_error_handler(
    _: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    details = [
        {
            "field": ".".join(str(part) for part in error["loc"]),
            "message": error["msg"],
            "type": error["type"],
        }
        for error in exc.errors()
    ]
    return _response(
        422,
        ErrorResponse(
            code="validation_error",
            message="Request validation failed.",
            details=details,
        ),
    )


async def http_error_handler(_: Request, exc: HTTPException) -> JSONResponse:
    codes = {
        401: "authentication_required",
        403: "forbidden",
        404: "not_found",
        409: "conflict",
    }
    message = exc.detail if isinstance(exc.detail, str) else "Request failed."
    details = exc.detail if isinstance(exc.detail, Mapping) else None
    return _response(
        exc.status_code,
        ErrorResponse(
            code=codes.get(exc.status_code, "http_error"),
            message=message,
            details=details,
        ),
    )


async def unexpected_error_handler(_: Request, __: Exception) -> JSONResponse:
    return _response(
        500,
        ErrorResponse(
            code="internal_error",
            message="An unexpected error occurred.",
        ),
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApiError, api_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(RequestValidationError, validation_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(HTTPException, http_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, unexpected_error_handler)
