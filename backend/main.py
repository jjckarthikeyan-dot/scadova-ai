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

from backend.loan_agency.schemas import (
    EmploymentProfileWithApplicationId,
    PersonalLoanProfileWithApplicationId,
    UsedCarLoanProfileWithApplicationId,
    BusinessLoanProfileWithApplicationId
)
from backend.loan_agency.router import (
    save_employment_profile_from_body,
    save_personal_loan_profile_from_body,
    save_used_car_loan_profile_from_body,
    save_business_loan_profile_from_body
)

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
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

# Direct aliases for Sarvam AI webhooks or root loan profile saves
@app.put("/employment", tags=["Loan Agency"])
@app.post("/employment", tags=["Loan Agency"])
@app.put("/api/loan/employment", tags=["Loan Agency"])
@app.post("/api/loan/employment", tags=["Loan Agency"])
async def root_employment_alias(payload: EmploymentProfileWithApplicationId):
    return await save_employment_profile_from_body(payload)

@app.put("/personal-loans", tags=["Loan Agency"])
@app.post("/personal-loans", tags=["Loan Agency"])
@app.put("/api/loan/personal-loans", tags=["Loan Agency"])
@app.post("/api/loan/personal-loans", tags=["Loan Agency"])
async def root_personal_loans_alias(payload: PersonalLoanProfileWithApplicationId):
    return await save_personal_loan_profile_from_body(payload)

@app.put("/used-car-loans", tags=["Loan Agency"])
@app.post("/used-car-loans", tags=["Loan Agency"])
@app.put("/api/loan/used-car-loans", tags=["Loan Agency"])
@app.post("/api/loan/used-car-loans", tags=["Loan Agency"])
async def root_used_car_loans_alias(payload: UsedCarLoanProfileWithApplicationId):
    return await save_used_car_loan_profile_from_body(payload)

@app.put("/business-loans", tags=["Loan Agency"])
@app.post("/business-loans", tags=["Loan Agency"])
@app.put("/api/loan/business-loans", tags=["Loan Agency"])
@app.post("/api/loan/business-loans", tags=["Loan Agency"])
async def root_business_loans_alias(payload: BusinessLoanProfileWithApplicationId):
    return await save_business_loan_profile_from_body(payload)

# Service & Appointment Booking router
app.include_router(appointment_booking_router)

# Admin dashboard router
app.include_router(admin_router)


# ============================================================
# FRONTEND SPA & STATIC FILES
# ============================================================

dist_dir = workspace_dir / "frontend" / "dist"

if dist_dir.exists():
    assets_dir = dist_dir / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")


@app.get("/api-status")
def api_status():
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


@app.get("/")
async def serve_root():
    index_file = dist_dir / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return api_status()


@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    if (
        full_path.startswith("api/")
        or full_path.startswith("admin/")
        or full_path in ("docs", "openapi.json", "redoc", "health", "api-status")
    ):
        raise HTTPException(status_code=404, detail="Endpoint not found")

    target_file = dist_dir / full_path
    if dist_dir.exists() and target_file.is_file():
        return FileResponse(target_file)

    index_file = dist_dir / "index.html"
    if index_file.exists():
        return FileResponse(index_file)

    raise HTTPException(status_code=404, detail="Not found")
