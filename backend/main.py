import os
import sys
from pathlib import Path
from fastapi import FastAPI

# Ensure both repository root and backend directory are in sys.path
backend_dir = Path(__file__).resolve().parent
workspace_dir = backend_dir.parent
if str(workspace_dir) not in sys.path:
    sys.path.insert(0, str(workspace_dir))
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from restaurant.router import router as restaurant_router
from clinic.router import router as clinic_router
from backend.loan_agency.router import router as loan_agency_router
from backend.loan_agency.sarvam_router import router as sarvam_router
from backend.appointment_booking.router import router as appointment_booking_router
from backend.admin.routes import router as admin_router

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Scadova AI Backend",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Department routers
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

# Loan Agency & Sarvam routers
app.include_router(loan_agency_router)
app.include_router(sarvam_router)

# Service & Appointment Booking router
app.include_router(appointment_booking_router)

# Admin dashboard router
app.include_router(admin_router)


@app.get("/")
def home():
    return {
        "status": "Scadova AI Backend running",
        "business_types": [
            "service_and_appointment",
            "restaurant",
            "clinic",
            "loan_agency"
        ]
    }


@app.get("/health")
def health():
    return {
        "success": True,
        "status": "healthy"
    }
