import os
import sys
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

# Ensure path resolution
backend_dir = Path(__file__).resolve().parent
workspace_dir = backend_dir.parent
if str(workspace_dir) not in sys.path:
    sys.path.insert(0, str(workspace_dir))
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from backend.restaurant.router import router as restaurant_router
from backend.clinic.router import router as clinic_router
from backend.loan_agency.router import router as loan_agency_router
from backend.loan_agency.sarvam_router import router as sarvam_router
from backend.appointment_booking.router import router as appointment_booking_router
from backend.admin.routes import router as admin_router

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

# ============================================================
# API ROUTERS (registered first before frontend fallback)
# ============================================================

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

app.include_router(loan_agency_router)
app.include_router(sarvam_router)
app.include_router(appointment_booking_router)
app.include_router(admin_router)


@app.get("/api/health")
def health():
    return {
        "success": True,
        "status": "Scadova AI Backend running"
    }


@app.get("/health")
def health_compat():
    return {
        "success": True,
        "status": "healthy"
    }


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


# ============================================================
# FRONTEND SPA & STATIC ASSETS (mounted after API routes)
# ============================================================

frontend_path = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "frontend",
    "dist"
)

assets_path = os.path.join(frontend_path, "assets")

if os.path.exists(assets_path):
    app.mount(
        "/assets",
        StaticFiles(directory=assets_path),
        name="assets"
    )


@app.get("/")
async def serve_root():
    index_file = os.path.join(frontend_path, "index.html")
    if os.path.isfile(index_file):
        return FileResponse(index_file)
    return {
        "success": True,
        "status": "Scadova AI Backend running"
    }


@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    # Reject unknown API/admin endpoints so frontend gets proper 404 instead of HTML
    if (
        full_path.startswith("api/")
        or full_path.startswith("admin/")
        or full_path in ("docs", "openapi.json", "redoc", "health", "api/health", "api-status")
    ):
        raise HTTPException(status_code=404, detail=f"API endpoint '/{full_path}' not found")

    requested_file = os.path.join(frontend_path, full_path)

    if full_path and os.path.isfile(requested_file):
        return FileResponse(requested_file)

    index_file = os.path.join(frontend_path, "index.html")
    if os.path.isfile(index_file):
        return FileResponse(index_file)

    return {
        "success": True,
        "status": "Scadova AI Backend running"
    }