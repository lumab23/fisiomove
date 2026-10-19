from fastapi import APIRouter

from app.modules.auth.router import router as auth_router
from app.modules.patients.router import router as patients_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(patients_router)
