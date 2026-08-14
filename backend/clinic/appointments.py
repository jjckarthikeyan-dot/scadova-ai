from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def appointments_health():
    return {
        "success": True,
        "module": "clinic-appointments",
        "status": "running"
    }