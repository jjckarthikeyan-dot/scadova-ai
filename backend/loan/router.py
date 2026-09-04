from fastapi import APIRouter, HTTPException
from core.supabase import supabase
from .schemas import LoanApplicationCreate

router = APIRouter(
    prefix="/api/loan-agency",
    tags=["Loan Agency"]
)


@router.post("/applications")
async def create_loan_application(
    application: LoanApplicationCreate
):
    try:
        payload = application.model_dump()

        if payload.get("product_type"):
            payload["product_type"] = payload["product_type"].value

        response = (
            supabase
            .table("loan_applications")
            .insert(payload)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=500,
                detail="Supabase returned no data"
            )

        return response.data[0]

    except Exception as e:
        print("CREATE APPLICATION ERROR:", repr(e))

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )
@router.get("/applications/{application_id}")
async def get_loan_application(application_id: str):
    try:
        response = (
            supabase
            .table("loan_applications")
            .select("*")
            .eq("id", application_id)
            .single()
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=404,
                detail="Loan application not found"
            )

        return response.data

    except Exception as e:
        print("GET APPLICATION ERROR:", repr(e))

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )