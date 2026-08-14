from fastapi import FastAPI

from restaurant.router import router as restaurant_router
from clinic.router import router as clinic_router

app = FastAPI(
    title="Scadova AI Backend",
    version="1.0.0"
)

app.include_router(
    restaurant_router,
    prefix="/api/restaurant"
)

app.include_router(
    clinic_router,
    prefix="/api/clinic"
)


@app.get("/")
def home():
    return {
        "success": True,
        "status": "Scadova AI Backend running"
    }


@app.get("/health")
def health():
    return {
        "success": True,
        "status": "healthy"
    }