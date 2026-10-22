from fastapi import APIRouter

from app.modules.auth.router import router as auth_router
from app.modules.exercises.router import router as exercises_router
from app.modules.notes.router import router as notes_router
from app.modules.patients.router import router as patients_router
from app.modules.sessions.router import router as sessions_router
from app.modules.workouts.router import router as workouts_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(patients_router)
api_router.include_router(exercises_router)
api_router.include_router(workouts_router)
api_router.include_router(notes_router)
api_router.include_router(sessions_router)
