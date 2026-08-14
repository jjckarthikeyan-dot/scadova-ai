from fastapi import APIRouter

from backend.clinic.appointments import router as appointments_router
from backend.clinic.providers import router as providers_router

router = APIRouter()

router.include_router(
    appointments_router,
    prefix="/appointments",
    tags=["Clinic Appointments"]
)

router.include_router(
    providers_router,
    prefix="/providers",
    tags=["Clinic Providers"]
)


@router.get("/")
def clinic_home():
    return {
        "success": True,
        "module": "clinic",
        "status": "running"
    }