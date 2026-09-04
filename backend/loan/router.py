from fastapi import APIRouter, HTTPException
from backend.core.supabase import supabase
from .schemas import PersonalLoanProfileResponse

router = APIRouter(
    prefix="/api/loan-agency",
    tags=["Loan Agency"]
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


@router.put(
    "/personal-loans/{application_id}",
    response_model=PersonalLoanProfileResponse
)
async def update_personal_loan_profile(
    application_id: str,
    payload: PersonalLoanProfileResponse
):
    try:
        data = payload.model_dump(exclude_none=True)
        data.pop("id", None)
        data.pop("created_at", None)
        data.pop("updated_at", None)

        response = (
            supabase
            .table("personal_loan_profiles")
            .upsert({"application_id": application_id, **data})
            .execute()
        )

        if not response.data:
            raise HTTPException(status_code=500, detail="Supabase returned no data")

        return response.data[0]

    except Exception as e:
        print("UPDATE PERSONAL LOAN PROFILE ERROR:", repr(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/personal-loans/{application_id}",
    response_model=PersonalLoanProfileResponse
)
async def get_personal_loan_profile(application_id: str):
    try:
        response = (
            supabase
            .table("personal_loan_profiles")
            .select("*")
            .eq("application_id", application_id)
            .single()
            .execute()
        )

        if not response.data:
            raise HTTPException(status_code=404, detail="Personal loan profile not found")

        return response.data

    except Exception as e:
        print("GET PERSONAL LOAN PROFILE ERROR:", repr(e))
        raise HTTPException(status_code=500, detail=str(e))