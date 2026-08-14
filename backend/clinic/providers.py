from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def providers_health():
    return {
        "success": True,
        "module": "clinic-providers",
        "status": "running"
    }