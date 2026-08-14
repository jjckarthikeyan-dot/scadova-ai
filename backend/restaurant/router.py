from fastapi import APIRouter

from backend.restaurant.menu import router as menu_router
from backend.restaurant.orders import router as orders_router
from backend.restaurant.reservations import router as reservations_router
from backend.restaurant.catering import router as catering_router

router = APIRouter()

router.include_router(
    menu_router,
    prefix="/menu",
    tags=["Restaurant Menu"]
)

router.include_router(
    orders_router,
    prefix="/orders",
    tags=["Restaurant Orders"]
)

router.include_router(
    reservations_router,
    prefix="/reservations",
    tags=["Restaurant Reservations"]
)

router.include_router(
    catering_router,
    prefix="/catering",
    tags=["Restaurant Catering"]
)


@router.get("/")
def restaurant_home():
    return {
        "success": True,
        "module": "restaurant",
        "status": "running"
    }