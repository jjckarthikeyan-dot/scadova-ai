from fastapi import FastAPI

from restaurant.router import router as restaurant_router
from clinic.router import router as clinic_router
from loan.router import router as loan_router

app = FastAPI(
    title="Scadova AI Backend",
    version="1.0.0"
)

app.include_router(
    restaurant_router,
    prefix="/api/restaurant",
    tags=["Restaurant"]
)

app.include_router(
    clinic_router,
    prefix="/api/clinic",
    tags=["Clinic"]
)

app.include_router(
    loan_router,
    # prefix is already defined in loan/router.py as /api/loan-agency
    tags=["Loan"]
)


@app.get("/")
def home():
    return {
        "status": "Scadova AI Backend running",
        "business_types": [
            "restaurant",
            "clinic",
            "loan"
        ]
    }


@app.get("/health")
def health():
    return {
        "success": True,
        "status": "healthy"
    }