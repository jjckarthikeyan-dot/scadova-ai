from fastapi import APIRouter


router = APIRouter()


@router.get("/health")
def catering_health():
    return {
        "success": True,
        "module": "restaurant-catering",
        "status": "running"
    }