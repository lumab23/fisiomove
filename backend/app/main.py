from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.health import router as health_router
from app.api.router import api_router
from app.core.config import Environment, Settings, get_settings
from app.core.errors import register_exception_handlers
from app.core.observability import RequestMetadataMiddleware, configure_logging
from app.db.migrations import ensure_schema_ready
from app.db.session import Database


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build an application instance with explicit infrastructure dependencies."""
    app_settings = settings or get_settings()
    database = Database.from_settings(app_settings)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        try:
            if app_settings.environment is Environment.PRODUCTION:
                ensure_schema_ready(database.engine)
            yield
        finally:
            database.dispose()

    application = FastAPI(
        title=app_settings.app_name,
        debug=app_settings.debug,
        lifespan=lifespan,
    )
    application.state.settings = app_settings
    application.state.database = database
    configure_logging()
    application.add_middleware(RequestMetadataMiddleware)
    register_exception_handlers(application)
    application.include_router(health_router)
    application.include_router(api_router, prefix=app_settings.api_prefix)
    return application


app = create_app()
