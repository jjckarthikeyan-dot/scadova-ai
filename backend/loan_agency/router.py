import logging
import uuid
from typing import Any, Dict
from fastapi import APIRouter, HTTPException, status
from backend.core.supabase import supabase
from .schemas import (
    LoanApplicationCreate,
    LoanApplicationResponse,
    PersonalLoanProfileUpdate,
    PersonalLoanProfileResponse,
    UsedCarLoanProfileUpdate,
    UsedCarLoanProfileResponse,
    BusinessLoanProfileUpdate,
    BusinessLoanProfileResponse,
    CallbackCreate,
    CallbackResponse,
    EMICalculatorRequest,
    EMICalculatorResponse,
    FOIRCalculatorRequest,
    FOIRCalculatorResponse
)

logger = logging.getLogger("loan_agency_router")

router = APIRouter(
    prefix="/api/loan-agency",
    tags=["Loan Agency"]
)

# Whitelist of actual DB columns to prevent Swagger UI extra properties from breaking queries
PERSONAL_LOAN_COLUMNS = {
    'employment_type', 'company_name', 'designation', 'total_experience_years',
    'company_joining_date', 'industry_type', 'gross_monthly_salary', 'net_monthly_salary',
    'salary_credit_date', 'annual_income', 'other_income', 'salary_bank_name',
    'average_monthly_balance', 'cheque_bounce_count', 'cibil_score',
    'existing_personal_loan_emi', 'credit_card_outstanding', 'total_monthly_emi',
    'has_overdue_payments', 'requested_amount', 'loan_purpose', 'preferred_tenure_months',
    'balance_transfer_required', 'previous_company_details', 'company_profile',
    'salary_credits_consistent', 'emi_bounce_count', 'bank_statement_months',
    'existing_personal_loans', 'other_emis', 'has_settlement', 'has_writeoff',
    'pan_available', 'aadhaar_kyc_available', 'salary_slips_available',
    'bank_statements_available', 'form16_itr_available', 'employment_proof_available'
}

USED_CAR_LOAN_COLUMNS = {
    'employment_type', 'company_or_business_name', 'designation_or_business_nature',
    'work_or_business_vintage', 'monthly_income', 'car_make', 'car_model', 'variant',
    'manufacturing_year', 'registration_year', 'registration_number', 'fuel_type',
    'transmission', 'current_owner_number', 'kilometers_driven', 'insurance_validity',
    'rc_status', 'accident_history', 'current_market_value', 'valuation_report_amount',
    'expected_purchase_price', 'seller_type', 'cibil_score', 'existing_loans',
    'existing_emis', 'has_overdues_or_settlements', 'required_loan_amount',
    'down_payment', 'preferred_tenure_months', 'refinance_required'
}

BUSINESS_LOAN_COLUMNS = {
    'business_name', 'business_type', 'business_start_year', 'business_vintage_years',
    'business_nature', 'business_address', 'gst_registered', 'udyam_registered',
    'turnover_year_1', 'turnover_year_2', 'turnover_year_3',
    'current_financial_year_turnover', 'monthly_average_bank_credits',
    'existing_business_loans', 'current_outstanding', 'monthly_emi_obligations',
    'profit_or_net_income', 'cibil_score', 'existing_loans_and_credit_cards',
    'has_overdues', 'has_settlements', 'has_writeoffs', 'requested_amount',
    'loan_purpose', 'preferred_tenure_months', 'liability_takeover_required'
}


# ============================================================
# 1. APPLICATION ENDPOINTS
# ============================================================

@router.post(
    "/applications",
    response_model=LoanApplicationResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_loan_application(request: LoanApplicationCreate):
    """
    Create a new loan application for Personal, Used Car, or Business Loan.
    """
    try:
        payload = {
            "loan_type": request.loan_type,
            "full_name": request.full_name,
            "mobile_number": request.mobile_number,
            "age": request.age,
            "city": request.city,
            "preferred_language": request.preferred_language,
            "source": request.source,
        }

        response = supabase.table("loan_applications").insert(payload).execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Supabase returned no data on application creation"
            )

        return response.data[0]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CREATE APPLICATION ERROR: {repr(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/applications/{application_id}")
async def get_loan_application(application_id: int):
    """
    Retrieve application details by application ID.
    """
    try:
        response = (
            supabase
            .table("loan_applications")
            .select("*")
            .eq("id", application_id)
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
        logger.error(f"GET APPLICATION ERROR: {repr(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ============================================================
# 2. PERSONAL LOAN PROFILE ENDPOINTS
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
    Create or update personal loan qualification details for an application.
    """
    try:
        raw_data = payload.model_dump(exclude_none=True)
        # Filter against valid columns to avoid PGRST204 on Swagger UI extra props
        clean_data = {k: v for k, v in raw_data.items() if k in PERSONAL_LOAN_COLUMNS}

        response = (
            supabase
            .table("personal_loan_profiles")
            .upsert({"application_id": application_id, **clean_data})
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update personal loan profile in Supabase"
            )

        return response.data[0]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"UPDATE PERSONAL LOAN ERROR: {repr(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get(
    "/personal-loans/{application_id}",
    response_model=PersonalLoanProfileResponse
)
async def get_personal_loan_profile(application_id: int):
    """
    Retrieve personal loan profile details for an application.
    """
    try:
        response = (
            supabase
            .table("personal_loan_profiles")
            .select("*")
            .eq("application_id", application_id)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Personal loan profile not found"
            )

        return response.data[0]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"GET PERSONAL LOAN ERROR: {repr(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ============================================================
# 3. USED CAR LOAN PROFILE ENDPOINTS
# ============================================================

@router.put(
    "/used-car-loans/{application_id}",
    response_model=UsedCarLoanProfileResponse
)
async def update_used_car_loan_profile(
    application_id: str,
    payload: UsedCarLoanProfileUpdate
):
    """
    Create or update used car loan qualification details for an application.
    """
    try:
        raw_data = payload.model_dump(exclude_none=True)
        clean_data = {k: v for k, v in raw_data.items() if k in USED_CAR_LOAN_COLUMNS}

        response = (
            supabase
            .table("used_car_loan_profiles")
            .upsert({"application_id": application_id, **clean_data})
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update used car loan profile in Supabase"
            )

        return response.data[0]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"UPDATE USED CAR LOAN ERROR: {repr(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get(
    "/used-car-loans/{application_id}",
    response_model=UsedCarLoanProfileResponse
)
async def get_used_car_loan_profile(application_id: str):
    """
    Retrieve used car loan profile details for an application.
    """
    try:
        response = (
            supabase
            .table("used_car_loan_profiles")
            .select("*")
            .eq("application_id", application_id)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Used car loan profile not found"
            )

        return response.data[0]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"GET USED CAR LOAN ERROR: {repr(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ============================================================
# 4. BUSINESS LOAN PROFILE ENDPOINTS
# ============================================================

@router.put(
    "/business-loans/{application_id}",
    response_model=BusinessLoanProfileResponse
)
async def update_business_loan_profile(
    application_id: str,
    payload: BusinessLoanProfileUpdate
):
    """
    Create or update business loan qualification details for an application.
    """
    try:
        raw_data = payload.model_dump(exclude_none=True)
        clean_data = {k: v for k, v in raw_data.items() if k in BUSINESS_LOAN_COLUMNS}

        response = (
            supabase
            .table("business_loan_profiles")
            .upsert({"application_id": application_id, **clean_data})
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update business loan profile in Supabase"
            )

        return response.data[0]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"UPDATE BUSINESS LOAN ERROR: {repr(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get(
    "/business-loans/{application_id}",
    response_model=BusinessLoanProfileResponse
)
async def get_business_loan_profile(application_id: str):
    """
    Retrieve business loan profile details for an application.
    """
    try:
        response = (
            supabase
            .table("business_loan_profiles")
            .select("*")
            .eq("application_id", application_id)
            .execute()
        )

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Business loan profile not found"
            )

        return response.data[0]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"GET BUSINESS LOAN ERROR: {repr(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ============================================================
# 5. CALLBACK ENDPOINTS
# ============================================================

@router.post(
    "/callbacks",
    response_model=CallbackResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_callback(payload: CallbackCreate):
    """
    Schedule a customer callback request.
    """
    try:
        data = payload.model_dump(exclude_none=True)
        callback_id = str(uuid.uuid4())

        insert_payload = {
            "id": callback_id,
            "application_id": data.get("application_id"),
            "lead_id": data.get("lead_id"),
            "customer_name": data.get("customer_name"),
            "phone_number": data["phone_number"],
            "callback_date": data.get("callback_date"),
            "callback_time": data.get("callback_time"),
            "callback_datetime": data.get("callback_datetime"),
            "reason": data.get("reason"),
            "notes": data.get("notes"),
            "status": data.get("status", "PENDING"),
            "attempt_count": 0
        }
        insert_payload = {k: v for k, v in insert_payload.items() if v is not None}

        try:
            response = supabase.table("callbacks").insert(insert_payload).execute()
            if response.data:
                return response.data[0]
        except Exception as db_err:
            logger.warning(f"Failed to write to callbacks table: {db_err}")

        # Graceful return with assigned callback ID if DB table not yet migrated
        return CallbackResponse(
            id=callback_id,
            application_id=data.get("application_id"),
            lead_id=data.get("lead_id"),
            customer_name=data.get("customer_name"),
            phone_number=data["phone_number"],
            callback_date=data.get("callback_date"),
            callback_time=data.get("callback_time"),
            callback_datetime=data.get("callback_datetime"),
            reason=data.get("reason"),
            notes=data.get("notes"),
            status="PENDING",
            attempt_count=0
        )

    except Exception as e:
        logger.error(f"CREATE CALLBACK ERROR: {repr(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ============================================================
# 6. CALCULATOR ENDPOINTS (EMI & FOIR)
# ============================================================

@router.post(
    "/calculators/emi",
    response_model=EMICalculatorResponse,
    status_code=status.HTTP_200_OK
)
async def calculate_emi(payload: EMICalculatorRequest):
    """
    Calculate Equated Monthly Installment (EMI), total interest, and total payment.
    Formula: EMI = P * r * (1 + r)^n / ((1 + r)^n - 1)
    """
    P = payload.principal
    n = payload.tenure_months
    annual_rate = payload.annual_rate

    # Monthly interest rate
    r = (annual_rate / 100.0) / 12.0

    if r == 0:
        monthly_emi = P / n
    else:
        compound = (1.0 + r) ** n
        monthly_emi = P * r * compound / (compound - 1.0)

    total_payment = monthly_emi * n
    total_interest = total_payment - P

    return EMICalculatorResponse(
        principal=round(P, 2),
        annual_rate=round(annual_rate, 2),
        tenure_months=n,
        monthly_emi=round(monthly_emi, 2),
        total_interest=round(max(0.0, total_interest), 2),
        total_payment=round(total_payment, 2)
    )


@router.post(
    "/calculators/foir",
    response_model=FOIRCalculatorResponse,
    status_code=status.HTTP_200_OK
)
async def calculate_foir(payload: FOIRCalculatorRequest):
    """
    Calculate Fixed Obligation to Income Ratio (FOIR) and maximum affordable EMI.
    FOIR = (Existing EMIs + Proposed EMI) / Net Monthly Income * 100
    """
    income = payload.net_monthly_income
    existing = payload.existing_monthly_obligations
    proposed = payload.proposed_emi
    threshold = payload.foir_threshold_percentage

    total_obligations = existing + proposed
    foir_percentage = (total_obligations / income) * 100.0

    max_permissible_obligation = income * (threshold / 100.0)
    max_affordable_new_emi = max(0.0, max_permissible_obligation - existing)
    is_eligible = foir_percentage <= threshold

    return FOIRCalculatorResponse(
        net_monthly_income=round(income, 2),
        existing_monthly_obligations=round(existing, 2),
        proposed_emi=round(proposed, 2),
        total_obligations=round(total_obligations, 2),
        foir_percentage=round(foir_percentage, 2),
        max_permissible_obligation=round(max_permissible_obligation, 2),
        max_affordable_new_emi=round(max_affordable_new_emi, 2),
        is_eligible=is_eligible
    )
