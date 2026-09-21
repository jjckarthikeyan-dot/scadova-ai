import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.restaurant.router import router as restaurant_router
from backend.clinic.router import router as clinic_router
from backend.loan.router import router as loan_router

app = FastAPI(
    title="Scadova AI Backend",
    version="1.0.0"
)

# API routes come first
app.include_router(
    restaurant_router,
    prefix="/api/restaurant"
)

app.include_router(
    clinic_router,
    prefix="/api/clinic"
)

app.include_router(
    loan_router
)


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


# Frontend static files and SPA fallback mounted after API routes
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


@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
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