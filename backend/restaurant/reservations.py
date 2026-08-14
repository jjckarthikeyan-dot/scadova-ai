from fastapi import APIRouter


router = APIRouter()


@router.get("/health")
def reservations_health():
    return {
        "success": True,
        "module": "restaurant-reservations",
        "status": "running"
    }