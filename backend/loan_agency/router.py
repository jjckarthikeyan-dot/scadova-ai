import logging
import uuid

from typing import Any, Dict

from fastapi import APIRouter, HTTPException, status

from backend.core.supabase import supabase

from .schemas import (
    LoanApplicationCreate,
    LoanApplicationResponse,

    EmploymentProfileUpdate,
    EmploymentProfileWithApplicationId,
    EmploymentProfileResponse,

    PersonalLoanProfileUpdate,
    PersonalLoanProfileWithApplicationId,
    PersonalLoanProfileResponse,

    UsedCarLoanProfileUpdate,
    UsedCarLoanProfileWithApplicationId,
    UsedCarLoanProfileResponse,

    BusinessLoanProfileUpdate,
    BusinessLoanProfileWithApplicationId,
    BusinessLoanProfileResponse,

    CallbackCreate,
    CallbackResponse,

    EMICalculatorRequest,
    EMICalculatorResponse,

    FOIRCalculatorRequest,
    FOIRCalculatorResponse,
)


logger = logging.getLogger("loan_agency_router")


router = APIRouter(
    prefix="/api/loan-agency",
    tags=["Loan Agency"]
)


# ============================================================
# DATABASE COLUMN WHITELISTS
# ============================================================

EMPLOYMENT_COLUMNS = {
    "employment_type",

    # Salaried
    "company_name",
    "designation",
    "industry_type",
    "total_experience_years",
    "company_joining_date",
    "gross_monthly_salary",
    "net_monthly_salary",
    "annual_income",
    "salary_bank_name",

    # Self-employed
    "business_name",
    "business_nature",
    "business_start_year",
    "business_vintage_years",
    "monthly_business_income",
}


PERSONAL_LOAN_COLUMNS = {
    "employment_type",
    "company_name",
    "designation",
    "total_experience_years",
    "company_joining_date",
    "industry_type",
    "gross_monthly_salary",
    "net_monthly_salary",
    "salary_credit_date",
    "annual_income",
    "other_income",
    "salary_bank_name",

    "average_monthly_balance",
    "cheque_bounce_count",
    "cibil_score",

    "existing_personal_loan_emi",
    "credit_card_outstanding",
    "total_monthly_emi",

    "has_overdue_payments",
    "requested_amount",
    "loan_purpose",
    "preferred_tenure_months",

    "balance_transfer_required",
    "previous_company_details",
    "company_profile",

    "salary_credits_consistent",
    "emi_bounce_count",
    "bank_statement_months",

    "existing_personal_loans",
    "other_emis",

    "has_settlement",
    "has_writeoff",

    "pan_available",
    "aadhaar_kyc_available",
    "salary_slips_available",
    "bank_statements_available",
    "form16_itr_available",
    "employment_proof_available",
}


USED_CAR_LOAN_COLUMNS = {
    # Old employment fields kept temporarily
    "employment_type",
    "company_or_business_name",
    "designation_or_business_nature",
    "work_or_business_vintage",
    "monthly_income",

    # Vehicle
    "car_make",
    "car_model",
    "variant",
    "manufacturing_year",
    "registration_year",
    "registration_number",
    "fuel_type",
    "transmission",
    "current_owner_number",
    "kilometers_driven",
    "insurance_validity",
    "rc_status",
    "accident_history",

    # Valuation
    "current_market_value",
    "valuation_report_amount",
    "expected_purchase_price",
    "seller_type",

    # Credit
    "cibil_score",
    "existing_loans",
    "existing_emis",
    "has_overdues_or_settlements",

    # Requirement
    "required_loan_amount",
    "down_payment",
    "preferred_tenure_months",
    "refinance_required",
}


BUSINESS_LOAN_COLUMNS = {
    "business_name",
    "business_type",
    "business_start_year",
    "business_vintage_years",
    "business_nature",
    "business_address",

    "gst_registered",
    "udyam_registered",

    "turnover_year_1",
    "turnover_year_2",
    "turnover_year_3",

    "current_financial_year_turnover",
    "monthly_average_bank_credits",

    "existing_business_loans",
    "current_outstanding",
    "monthly_emi_obligations",
    "profit_or_net_income",

    "cibil_score",
    "existing_loans_and_credit_cards",

    "has_overdues",
    "has_settlements",
    "has_writeoffs",

    "requested_amount",
    "loan_purpose",
    "preferred_tenure_months",

    "liability_takeover_required",
}


# ============================================================
# HELPER FUNCTIONS
# ============================================================

class AwaitableDict(dict):
    """A dictionary that can also be awaited in async functions if needed."""
    def __await__(self):
        async def _coro():
            return self
        return _coro().__await__()


def ensure_application_exists(application_id: int) -> Dict[str, Any]:
    """
    Confirm that a database loan application exists before writing
    employment/product-specific information.
    """

    response = (
        supabase
        .table("loan_applications")
        .select("*")
        .eq("id", application_id)
        .limit(1)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Loan application {application_id} not found"
        )

    return AwaitableDict(response.data[0])


# ============================================================
# 1. APPLICATION ENDPOINTS
# ============================================================

@router.post(
    "/applications",
    response_model=LoanApplicationResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_loan_application(
    request: LoanApplicationCreate
):
    """
    Create one loan application.

    IMPORTANT:

    Sarvam interaction ID and database application ID are different.

    sarvam_interaction_id:
        identifies the Sarvam conversation/call.

    id:
        database application ID generated by Supabase.

    If the same Sarvam interaction calls this endpoint more than once,
    return the existing database application instead of creating a
    duplicate.
    """

    try:

        # ----------------------------------------------------
        # 1. IDEMPOTENCY CHECK
        # ----------------------------------------------------

        if request.sarvam_interaction_id:

            existing_response = (
                supabase
                .table("loan_applications")
                .select("*")
                .eq(
                    "sarvam_interaction_id",
                    request.sarvam_interaction_id
                )
                .limit(1)
                .execute()
            )

            if existing_response.data:

                existing_application = existing_response.data[0]

                logger.info(
                    "Existing loan application returned for "
                    f"Sarvam interaction "
                    f"{request.sarvam_interaction_id}. "
                    f"Application ID: "
                    f"{existing_application.get('id')}"
                )

                return existing_application


        # ----------------------------------------------------
        # 2. BUILD DATABASE PAYLOAD
        # ----------------------------------------------------

        payload = {
            "loan_type": request.loan_type,
            "full_name": request.full_name,
            "mobile_number": request.mobile_number,

            "age": request.age,
            "city": request.city,

            "preferred_language": request.preferred_language,
            "source": request.source,

            "sarvam_interaction_id":
                request.sarvam_interaction_id,

            "email": request.email,
            "pan_number": request.pan_number,
            "aadhaar_number": request.aadhaar_number,

            "requested_amount":
                request.requested_amount,

            "preferred_tenure_months":
                request.preferred_tenure_months,

            "loan_purpose":
                request.loan_purpose,
        }

        # Remove None values
        payload = {
            key: value
            for key, value in payload.items()
            if value is not None
        }


        # ----------------------------------------------------
        # 3. CREATE APPLICATION
        # ----------------------------------------------------

        response = (
            supabase
            .table("loan_applications")
            .insert(payload)
            .execute()
        )


        if not response.data:

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=(
                    "Supabase returned no data "
                    "when creating loan application"
                )
            )


        application = response.data[0]

        logger.info(
            "Loan application created. "
            f"Application ID: {application.get('id')} | "
            f"Sarvam Interaction ID: "
            f"{request.sarvam_interaction_id}"
        )


        return application


    except HTTPException:
        raise


    except Exception as e:

        logger.exception(
            "CREATE LOAN APPLICATION ERROR"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ============================================================
# GET APPLICATION
# ============================================================

@router.get(
    "/applications/{application_id}",
    response_model=LoanApplicationResponse
)
async def get_loan_application(
    application_id: int
):
    """
    Retrieve loan application using database application ID.
    """

    try:

        response = (
            supabase
            .table("loan_applications")
            .select("*")
            .eq("id", application_id)
            .limit(1)
            .execute()
        )


        if not response.data:

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Loan application not found"
            )


        return response.data[0]


    except HTTPException:
        raise


    except Exception as e:

        logger.exception(
            "GET LOAN APPLICATION ERROR"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ============================================================
# GET APPLICATION BY SARVAM INTERACTION
# ============================================================

@router.get(
    "/applications/sarvam/{sarvam_interaction_id}",
    response_model=LoanApplicationResponse
)
async def get_application_by_sarvam_interaction(
    sarvam_interaction_id: str
):
    """
    Useful for debugging/tracing a Sarvam interaction to its
    database application ID.
    """

    try:

        response = (
            supabase
            .table("loan_applications")
            .select("*")
            .eq(
                "sarvam_interaction_id",
                sarvam_interaction_id
            )
            .limit(1)
            .execute()
        )


        if not response.data:

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=(
                    "No loan application found for "
                    "this Sarvam interaction ID"
                )
            )


        return response.data[0]


    except HTTPException:
        raise


    except Exception as e:

        logger.exception(
            "GET APPLICATION BY SARVAM ID ERROR"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ============================================================
# GET APPLICATION BY MOBILE NUMBER
# ============================================================

@router.get(
    "/applications/mobile/{mobile_number}",
    response_model=LoanApplicationResponse
)
async def get_application_by_mobile(
    mobile_number: str
):
    """
    Retrieve the latest loan application for a customer mobile number.
    Supports normalized formatting (e.g. stripping spaces, hyphens) and country-code variants.
    """
    normalized_mobile = (
        mobile_number
        .replace(" ", "")
        .replace("-", "")
    )

    try:
        response = (
            supabase
            .table("loan_applications")
            .select("*")
            .eq("mobile_number", normalized_mobile)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )

        if not response.data:
            alt_numbers = []
            if normalized_mobile.startswith("+91") and len(normalized_mobile) > 3:
                alt_numbers.append(normalized_mobile[3:])
            elif normalized_mobile.startswith("91") and len(normalized_mobile) == 12:
                alt_numbers.append(normalized_mobile[2:])
            elif len(normalized_mobile) == 10:
                alt_numbers.append(f"+91{normalized_mobile}")
                alt_numbers.append(f"91{normalized_mobile}")

            for alt in alt_numbers:
                alt_response = (
                    supabase
                    .table("loan_applications")
                    .select("*")
                    .eq("mobile_number", alt)
                    .order("created_at", desc=True)
                    .limit(1)
                    .execute()
                )
                if alt_response.data:
                    response = alt_response
                    break

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No application found for this mobile number"
            )

        return response.data[0]

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("GET APPLICATION BY MOBILE ERROR")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/applications/mobile/{mobile_number}/all")
async def get_all_applications_by_mobile(
    mobile_number: str
):
    """
    Retrieve all applications for a customer mobile number ordered newest first.
    """
    normalized_mobile = (
        mobile_number
        .replace(" ", "")
        .replace("-", "")
    )

    try:
        response = (
            supabase
            .table("loan_applications")
            .select("*")
            .eq("mobile_number", normalized_mobile)
            .order("created_at", desc=True)
            .execute()
        )

        if not response.data:
            alt_numbers = []
            if normalized_mobile.startswith("+91") and len(normalized_mobile) > 3:
                alt_numbers.append(normalized_mobile[3:])
            elif normalized_mobile.startswith("91") and len(normalized_mobile) == 12:
                alt_numbers.append(normalized_mobile[2:])
            elif len(normalized_mobile) == 10:
                alt_numbers.append(f"+91{normalized_mobile}")
                alt_numbers.append(f"91{normalized_mobile}")

            for alt in alt_numbers:
                alt_response = (
                    supabase
                    .table("loan_applications")
                    .select("*")
                    .eq("mobile_number", alt)
                    .order("created_at", desc=True)
                    .execute()
                )
                if alt_response.data:
                    response = alt_response
                    break

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No applications found for this mobile number"
            )

        return {
            "count": len(response.data),
            "applications": response.data
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("GET ALL APPLICATIONS BY MOBILE ERROR")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ============================================================
# 2. COMMON EMPLOYMENT PROFILE
# ============================================================

@router.put(
    "/employment/{application_id}",
    response_model=EmploymentProfileResponse
)
async def update_employment_profile(
    application_id: int,
    payload: EmploymentProfileUpdate
):
    """
    Save applicant income/employment profile.

    This table is shared by:
    - Personal Loan
    - Business Loan
    - Used Car Loan

    application_id must always be the DATABASE loan application ID.
    """

    try:

        # Confirm parent application exists
        ensure_application_exists(application_id)


        raw_data = payload.model_dump(
            exclude_none=True
        )


        clean_data = {
            key: value
            for key, value in raw_data.items()
            if key in EMPLOYMENT_COLUMNS
        }


        database_payload = {
            "application_id": application_id,
            **clean_data
        }


        response = (
            supabase
            .table("employment_profiles")
            .upsert(
                database_payload,
                on_conflict="application_id"
            )
            .execute()
        )


        if not response.data:

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=(
                    "Failed to save employment profile "
                    "in Supabase"
                )
            )


        return response.data[0]


    except HTTPException:
        raise


    except Exception as e:

        logger.exception(
            "UPDATE EMPLOYMENT PROFILE ERROR"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.put("/employment")
@router.post("/employment")
async def save_employment_profile_from_body(
    payload: EmploymentProfileWithApplicationId
):
    """
    Direct endpoint specifically for Sarvam AI voice telephony tools and webhooks,
    where application_id is included in the request body.
    """
    application_id = payload.application_id

    await ensure_application_exists(application_id)

    data = payload.model_dump(
        exclude={"application_id"},
        exclude_none=True
    )

    data["application_id"] = application_id

    result = (
        supabase.table("employment_profiles")
        .upsert(
            data,
            on_conflict="application_id"
        )
        .execute()
    )

    if result.data and len(result.data) > 0:
        return result.data[0]
    return data


# ============================================================
# GET EMPLOYMENT PROFILE
# ============================================================

@router.get(
    "/employment/{application_id}",
    response_model=EmploymentProfileResponse
)
async def get_employment_profile(
    application_id: int
):
    """
    Retrieve applicant employment profile.
    """

    try:

        response = (
            supabase
            .table("employment_profiles")
            .select("*")
            .eq("application_id", application_id)
            .limit(1)
            .execute()
        )


        if not response.data:

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Employment profile not found"
            )


        return response.data[0]


    except HTTPException:
        raise


    except Exception as e:

        logger.exception(
            "GET EMPLOYMENT PROFILE ERROR"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ============================================================
# 3. PERSONAL LOAN PROFILE
# ============================================================

@router.put(
    "/personal-loans/{application_id}",
    response_model=PersonalLoanProfileResponse
)
async def update_personal_loan_profile(
    application_id: int,
    payload: PersonalLoanProfileUpdate
):
    """
    Create/update Personal Loan qualification information.
    """

    try:

        application = ensure_application_exists(
            application_id
        )


        # Protect against writing personal-loan data
        # into a different product application.
        if application.get("loan_type") != "personal_loan":

            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Application {application_id} is "
                    f"{application.get('loan_type')}, "
                    "not personal_loan"
                )
            )


        raw_data = payload.model_dump(
            exclude_none=True
        )


        clean_data = {
            key: value
            for key, value in raw_data.items()
            if key in PERSONAL_LOAN_COLUMNS
        }


        response = (
            supabase
            .table("personal_loan_profiles")
            .upsert(
                {
                    "application_id": application_id,
                    **clean_data
                },
                on_conflict="application_id"
            )
            .execute()
        )


        if not response.data:

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=(
                    "Failed to update Personal Loan profile"
                )
            )


        return response.data[0]


    except HTTPException:
        raise


    except Exception as e:

        logger.exception(
            "UPDATE PERSONAL LOAN ERROR"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.put("/personal-loans")
@router.post("/personal-loans")
async def save_personal_loan_profile_from_body(
    payload: PersonalLoanProfileWithApplicationId
):
    """
    Direct endpoint for Sarvam AI voice telephony tools and webhooks,
    where application_id is included in the request body.
    """
    application_id = payload.application_id

    await ensure_application_exists(application_id)

    data = payload.model_dump(
        exclude={"application_id"},
        exclude_none=True
    )

    clean_data = {
        key: value
        for key, value in data.items()
        if key in PERSONAL_LOAN_COLUMNS
    }
    clean_data["application_id"] = application_id

    result = (
        supabase.table("personal_loan_profiles")
        .upsert(
            clean_data,
            on_conflict="application_id"
        )
        .execute()
    )

    if result.data and len(result.data) > 0:
        return result.data[0]
    return clean_data


@router.get(
    "/personal-loans/{application_id}",
    response_model=PersonalLoanProfileResponse
)
async def get_personal_loan_profile(
    application_id: int
):

    try:

        response = (
            supabase
            .table("personal_loan_profiles")
            .select("*")
            .eq("application_id", application_id)
            .limit(1)
            .execute()
        )


        if not response.data:

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Personal Loan profile not found"
            )


        return response.data[0]


    except HTTPException:
        raise


    except Exception as e:

        logger.exception(
            "GET PERSONAL LOAN ERROR"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ============================================================
# 4. USED CAR LOAN PROFILE
# ============================================================

@router.put(
    "/used-car-loans/{application_id}",
    response_model=UsedCarLoanProfileResponse
)
async def update_used_car_loan_profile(
    application_id: int,
    payload: UsedCarLoanProfileUpdate
):

    try:

        application = ensure_application_exists(
            application_id
        )


        if application.get("loan_type") != "used_car_loan":

            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Application {application_id} is "
                    f"{application.get('loan_type')}, "
                    "not used_car_loan"
                )
            )


        raw_data = payload.model_dump(
            exclude_none=True
        )


        clean_data = {
            key: value
            for key, value in raw_data.items()
            if key in USED_CAR_LOAN_COLUMNS
        }


        response = (
            supabase
            .table("used_car_loan_profiles")
            .upsert(
                {
                    "application_id": application_id,
                    **clean_data
                },
                on_conflict="application_id"
            )
            .execute()
        )


        if not response.data:

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=(
                    "Failed to update Used Car Loan profile"
                )
            )


        return response.data[0]


    except HTTPException:
        raise


    except Exception as e:

        logger.exception(
            "UPDATE USED CAR LOAN ERROR"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.put("/used-car-loans")
@router.post("/used-car-loans")
async def save_used_car_loan_profile_from_body(
    payload: UsedCarLoanProfileWithApplicationId
):
    """
    Direct endpoint for Sarvam AI voice telephony tools and webhooks,
    where application_id is included in the request body.
    """
    application_id = payload.application_id

    await ensure_application_exists(application_id)

    data = payload.model_dump(
        exclude={"application_id"},
        exclude_none=True
    )

    clean_data = {
        key: value
        for key, value in data.items()
        if key in USED_CAR_LOAN_COLUMNS
    }
    clean_data["application_id"] = application_id

    result = (
        supabase.table("used_car_loan_profiles")
        .upsert(
            clean_data,
            on_conflict="application_id"
        )
        .execute()
    )

    if result.data and len(result.data) > 0:
        return result.data[0]
    return clean_data


@router.get(
    "/used-car-loans/{application_id}",
    response_model=UsedCarLoanProfileResponse
)
async def get_used_car_loan_profile(
    application_id: int
):

    try:

        response = (
            supabase
            .table("used_car_loan_profiles")
            .select("*")
            .eq("application_id", application_id)
            .limit(1)
            .execute()
        )


        if not response.data:

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Used Car Loan profile not found"
            )


        return response.data[0]


    except HTTPException:
        raise


    except Exception as e:

        logger.exception(
            "GET USED CAR LOAN ERROR"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ============================================================
# 5. BUSINESS LOAN PROFILE
# ============================================================

@router.put(
    "/business-loans/{application_id}",
    response_model=BusinessLoanProfileResponse
)
async def update_business_loan_profile(
    application_id: int,
    payload: BusinessLoanProfileUpdate
):

    try:

        application = ensure_application_exists(
            application_id
        )


        if application.get("loan_type") != "business_loan":

            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Application {application_id} is "
                    f"{application.get('loan_type')}, "
                    "not business_loan"
                )
            )


        raw_data = payload.model_dump(
            exclude_none=True
        )


        clean_data = {
            key: value
            for key, value in raw_data.items()
            if key in BUSINESS_LOAN_COLUMNS
        }


        response = (
            supabase
            .table("business_loan_profiles")
            .upsert(
                {
                    "application_id": application_id,
                    **clean_data
                },
                on_conflict="application_id"
            )
            .execute()
        )


        if not response.data:

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=(
                    "Failed to update Business Loan profile"
                )
            )


        return response.data[0]


    except HTTPException:
        raise


    except Exception as e:

        logger.exception(
            "UPDATE BUSINESS LOAN ERROR"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.put("/business-loans")
@router.post("/business-loans")
async def save_business_loan_profile_from_body(
    payload: BusinessLoanProfileWithApplicationId
):
    """
    Direct endpoint for Sarvam AI voice telephony tools and webhooks,
    where application_id is included in the request body.
    """
    application_id = payload.application_id

    await ensure_application_exists(application_id)

    data = payload.model_dump(
        exclude={"application_id"},
        exclude_none=True
    )

    clean_data = {
        key: value
        for key, value in data.items()
        if key in BUSINESS_LOAN_COLUMNS
    }
    clean_data["application_id"] = application_id

    result = (
        supabase.table("business_loan_profiles")
        .upsert(
            clean_data,
            on_conflict="application_id"
        )
        .execute()
    )

    if result.data and len(result.data) > 0:
        return result.data[0]
    return clean_data


@router.get(
    "/business-loans/{application_id}",
    response_model=BusinessLoanProfileResponse
)
async def get_business_loan_profile(
    application_id: int
):

    try:

        response = (
            supabase
            .table("business_loan_profiles")
            .select("*")
            .eq("application_id", application_id)
            .limit(1)
            .execute()
        )


        if not response.data:

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Business Loan profile not found"
            )


        return response.data[0]


    except HTTPException:
        raise


    except Exception as e:

        logger.exception(
            "GET BUSINESS LOAN ERROR"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ============================================================
# 6. CALLBACK ENDPOINT
# ============================================================

@router.post(
    "/callbacks",
    response_model=CallbackResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_callback(
    payload: CallbackCreate
):

    try:

        data = payload.model_dump(
            exclude_none=True
        )


        if data.get("application_id") is not None:

            ensure_application_exists(
                data["application_id"]
            )


        callback_id = str(
            uuid.uuid4()
        )


        insert_payload = {
            "id": callback_id,

            "application_id":
                data.get("application_id"),

            "lead_id":
                data.get("lead_id"),

            "customer_name":
                data.get("customer_name"),

            "phone_number":
                data["phone_number"],

            "callback_date":
                data.get("callback_date"),

            "callback_time":
                data.get("callback_time"),

            "callback_datetime":
                data.get("callback_datetime"),

            "reason":
                data.get("reason"),

            "notes":
                data.get("notes"),

            "status":
                data.get(
                    "status",
                    "PENDING"
                ),

            "attempt_count": 0,
        }


        insert_payload = {
            key: value
            for key, value in insert_payload.items()
            if value is not None
        }


        try:

            response = (
                supabase
                .table("callbacks")
                .insert(insert_payload)
                .execute()
            )


            if response.data:
                return response.data[0]


        except Exception as db_err:

            logger.warning(
                f"Callback database insert failed: "
                f"{db_err}"
            )


        # Fallback response
        return CallbackResponse(
            id=callback_id,

            application_id=
                data.get("application_id"),

            lead_id=
                data.get("lead_id"),

            customer_name=
                data.get("customer_name"),

            phone_number=
                data["phone_number"],

            callback_date=
                data.get("callback_date"),

            callback_time=
                data.get("callback_time"),

            callback_datetime=
                data.get("callback_datetime"),

            reason=
                data.get("reason"),

            notes=
                data.get("notes"),

            status="PENDING",

            attempt_count=0
        )


    except HTTPException:
        raise


    except Exception as e:

        logger.exception(
            "CREATE CALLBACK ERROR"
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ============================================================
# 7. EMI CALCULATOR
# ============================================================

@router.post(
    "/calculators/emi",
    response_model=EMICalculatorResponse,
    status_code=status.HTTP_200_OK
)
async def calculate_emi(
    payload: EMICalculatorRequest
):

    principal = payload.principal

    tenure_months = payload.tenure_months

    annual_rate = payload.annual_rate


    monthly_rate = (
        annual_rate / 100.0
    ) / 12.0


    if monthly_rate == 0:

        monthly_emi = (
            principal /
            tenure_months
        )


    else:

        compound = (
            1.0 + monthly_rate
        ) ** tenure_months


        monthly_emi = (
            principal
            * monthly_rate
            * compound
            / (
                compound - 1.0
            )
        )


    total_payment = (
        monthly_emi *
        tenure_months
    )


    total_interest = (
        total_payment -
        principal
    )


    return EMICalculatorResponse(

        principal=round(
            principal,
            2
        ),

        annual_rate=round(
            annual_rate,
            2
        ),

        tenure_months=
            tenure_months,

        monthly_emi=round(
            monthly_emi,
            2
        ),

        total_interest=round(
            max(
                0.0,
                total_interest
            ),
            2
        ),

        total_payment=round(
            total_payment,
            2
        )
    )


# ============================================================
# 8. FOIR CALCULATOR
# ============================================================

@router.post(
    "/calculators/foir",
    response_model=FOIRCalculatorResponse,
    status_code=status.HTTP_200_OK
)
async def calculate_foir(
    payload: FOIRCalculatorRequest
):

    income = (
        payload.net_monthly_income
    )

    existing = (
        payload.existing_monthly_obligations
    )

    proposed = (
        payload.proposed_emi
    )

    threshold = (
        payload.foir_threshold_percentage
    )


    total_obligations = (
        existing +
        proposed
    )


    foir_percentage = (
        total_obligations /
        income
    ) * 100.0


    max_permissible_obligation = (
        income *
        (
            threshold /
            100.0
        )
    )


    max_affordable_new_emi = max(
        0.0,
        max_permissible_obligation
        - existing
    )


    is_eligible = (
        foir_percentage
        <= threshold
    )


    return FOIRCalculatorResponse(

        net_monthly_income=round(
            income,
            2
        ),

        existing_monthly_obligations=round(
            existing,
            2
        ),

        proposed_emi=round(
            proposed,
            2
        ),

        total_obligations=round(
            total_obligations,
            2
        ),

        foir_percentage=round(
            foir_percentage,
            2
        ),

        max_permissible_obligation=round(
            max_permissible_obligation,
            2
        ),

        max_affordable_new_emi=round(
            max_affordable_new_emi,
            2
        ),

        is_eligible=
            is_eligible
    )
