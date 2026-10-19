from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.health import router as health_router
from app.api.router import api_router
from app.core.config import Settings, get_settings
from app.core.errors import register_exception_handlers
from app.db.session import Database


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build an application instance with explicit infrastructure dependencies."""
    app_settings = settings or get_settings()
    database = Database(
        database_url=app_settings.database_url,
        echo=app_settings.db_echo,
    )

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        yield
        database.dispose()

    application = FastAPI(
        title=app_settings.app_name,
        debug=app_settings.debug,
        lifespan=lifespan,
    )
    application.state.settings = app_settings
    application.state.database = database
    register_exception_handlers(application)
    application.include_router(health_router)
    application.include_router(api_router, prefix=app_settings.api_prefix)
    return application


app = create_app()
