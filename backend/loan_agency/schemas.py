from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


# ============================================================
# LOAN APPLICATIONS SCHEMAS
# ============================================================

class LoanType(str, Enum):
    PERSONAL_LOAN = "personal_loan"
    BUSINESS_LOAN = "business_loan"
    USED_CAR_LOAN = "used_car_loan"


class LoanApplicationCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    loan_type: str = Field(default="personal_loan", description="personal_loan, business_loan, or used_car_loan")
    full_name: str = Field(..., min_length=2, max_length=150, description="Applicant full name")
    mobile_number: str = Field(..., min_length=8, max_length=20, description="Contact phone number")
    age: Optional[int] = Field(default=None, ge=18, le=100)
    city: Optional[str] = Field(default=None, max_length=100)
    preferred_language: Optional[str] = Field(default="English")
    source: Optional[str] = Field(default="voice_agent", description="Lead source")

    # Optional fields
    email: Optional[str] = None
    pan_number: Optional[str] = None
    aadhaar_number: Optional[str] = None
    requested_amount: Optional[float] = None
    preferred_tenure_months: Optional[int] = None
    loan_purpose: Optional[str] = None


class LoanApplicationResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: Any
    application_number: Optional[str] = None
    loan_type: Optional[str] = None
    full_name: Optional[str] = None
    mobile_number: Optional[str] = None
    age: Optional[int] = None
    city: Optional[str] = None
    preferred_language: Optional[str] = None
    source: Optional[str] = None
    email: Optional[str] = None
    pan_number: Optional[str] = None
    aadhaar_number: Optional[str] = None
    requested_amount: Optional[float] = None
    preferred_tenure_months: Optional[int] = None
    loan_purpose: Optional[str] = None
    status: Optional[str] = "DRAFT"
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


# ============================================================
# PERSONAL LOAN PROFILE SCHEMAS
# ============================================================

class PersonalLoanProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    employment_type: Optional[str] = None
    company_name: Optional[str] = None
    designation: Optional[str] = None
    total_experience_years: Optional[float] = None
    company_joining_date: Optional[str] = None
    previous_company_details: Optional[str] = None
    industry_type: Optional[str] = None
    company_profile: Optional[str] = None

    gross_monthly_salary: Optional[float] = None
    net_monthly_salary: Optional[float] = None
    salary_credit_date: Optional[int] = None
    annual_income: Optional[float] = None
    other_income: Optional[float] = None

    salary_bank_name: Optional[str] = None
    bank_statement_months: Optional[int] = None
    salary_credits_consistent: Optional[bool] = None
    cheque_bounce_count: Optional[int] = None
    emi_bounce_count: Optional[int] = None
    average_monthly_balance: Optional[float] = None

    cibil_score: Optional[int] = None
    existing_personal_loans: Optional[str] = None
    existing_personal_loan_emi: Optional[float] = None
    credit_card_outstanding: Optional[float] = None
    other_emis: Optional[float] = None
    total_monthly_emi: Optional[float] = None

    has_overdue_payments: Optional[bool] = None
    has_settlement: Optional[bool] = None
    has_writeoff: Optional[bool] = None

    requested_amount: Optional[float] = None
    loan_purpose: Optional[str] = None
    preferred_tenure_months: Optional[int] = None
    balance_transfer_required: Optional[bool] = None

    pan_available: Optional[bool] = None
    aadhaar_kyc_available: Optional[bool] = None
    salary_slips_available: Optional[bool] = None
    bank_statements_available: Optional[bool] = None
    form16_itr_available: Optional[bool] = None
    employment_proof_available: Optional[bool] = None


class PersonalLoanProfileResponse(PersonalLoanProfileUpdate):
    id: Optional[int] = None
    application_id: int
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


# ============================================================
# USED CAR LOAN PROFILE SCHEMAS
# ============================================================

class UsedCarLoanProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    employment_type: Optional[str] = None
    company_or_business_name: Optional[str] = None
    designation_or_business_nature: Optional[str] = None
    work_or_business_vintage: Optional[float] = None
    monthly_income: Optional[float] = None

    car_make: Optional[str] = None
    car_model: Optional[str] = None
    variant: Optional[str] = None
    manufacturing_year: Optional[int] = None
    registration_year: Optional[int] = None
    registration_number: Optional[str] = None
    fuel_type: Optional[str] = None
    transmission: Optional[str] = None
    current_owner_number: Optional[int] = None
    kilometers_driven: Optional[float] = None
    insurance_validity: Optional[str] = None
    rc_status: Optional[str] = None
    accident_history: Optional[str] = None

    current_market_value: Optional[float] = None
    valuation_report_amount: Optional[float] = None
    expected_purchase_price: Optional[float] = None
    seller_type: Optional[str] = None

    cibil_score: Optional[int] = None
    existing_loans: Optional[str] = None
    existing_emis: Optional[float] = None
    has_overdues_or_settlements: Optional[bool] = None

    required_loan_amount: Optional[float] = None
    down_payment: Optional[float] = None
    preferred_tenure_months: Optional[int] = None
    refinance_required: Optional[bool] = None


class UsedCarLoanProfileResponse(UsedCarLoanProfileUpdate):
    id: Optional[str] = None
    application_id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


# ============================================================
# BUSINESS LOAN PROFILE SCHEMAS
# ============================================================

class BusinessLoanProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    business_name: Optional[str] = None
    business_type: Optional[str] = None
    business_start_year: Optional[int] = None
    business_vintage_years: Optional[float] = None
    business_nature: Optional[str] = None
    business_address: Optional[str] = None
    gst_registered: Optional[bool] = None
    udyam_registered: Optional[bool] = None

    turnover_year_1: Optional[float] = None
    turnover_year_2: Optional[float] = None
    turnover_year_3: Optional[float] = None
    current_financial_year_turnover: Optional[float] = None
    monthly_average_bank_credits: Optional[float] = None

    existing_business_loans: Optional[str] = None
    current_outstanding: Optional[float] = None
    monthly_emi_obligations: Optional[float] = None
    profit_or_net_income: Optional[float] = None

    cibil_score: Optional[int] = None
    existing_loans_and_credit_cards: Optional[str] = None
    has_overdues: Optional[bool] = None
    has_settlements: Optional[bool] = None
    has_writeoffs: Optional[bool] = None

    requested_amount: Optional[float] = None
    loan_purpose: Optional[str] = None
    preferred_tenure_months: Optional[int] = None
    liability_takeover_required: Optional[bool] = None


class BusinessLoanProfileResponse(BusinessLoanProfileUpdate):
    id: Optional[str] = None
    application_id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


# ============================================================
# CALLBACK SCHEMAS
# ============================================================

class CallbackCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    application_id: Optional[str] = None
    lead_id: Optional[str] = None
    customer_name: Optional[str] = None
    phone_number: str = Field(..., min_length=8, max_length=20)
    callback_date: Optional[str] = None
    callback_time: Optional[str] = None
    callback_datetime: Optional[str] = None
    reason: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = "PENDING"


class CallbackResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    application_id: Optional[str] = None
    lead_id: Optional[str] = None
    customer_name: Optional[str] = None
    phone_number: str
    callback_date: Optional[str] = None
    callback_time: Optional[str] = None
    callback_datetime: Optional[str] = None
    reason: Optional[str] = None
    status: str = "PENDING"
    attempt_count: int = 0
    notes: Optional[str] = None
    created_at: Optional[str] = None


# ============================================================
# CALCULATOR SCHEMAS
# ============================================================

class EMICalculatorRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    principal: float = Field(..., gt=0, description="Loan amount (Principal) in INR")
    annual_rate: float = Field(..., ge=0, le=100, description="Annual interest rate percentage, e.g. 10.5 for 10.5%")
    tenure_months: int = Field(..., gt=0, le=360, description="Loan tenure in months")


class EMICalculatorResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    principal: float
    annual_rate: float
    tenure_months: int
    monthly_emi: float
    total_interest: float
    total_payment: float


class FOIRCalculatorRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    net_monthly_income: float = Field(..., gt=0, description="Net monthly take-home income in INR")
    existing_monthly_obligations: float = Field(default=0.0, ge=0, description="Current monthly EMIs / debt obligations in INR")
    proposed_emi: float = Field(default=0.0, ge=0, description="Proposed new loan monthly EMI in INR")
    foir_threshold_percentage: float = Field(default=50.0, gt=0, le=100, description="Maximum permissible FOIR percentage (default 50%)")


class FOIRCalculatorResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    net_monthly_income: float
    existing_monthly_obligations: float
    proposed_emi: float
    total_obligations: float
    foir_percentage: float
    max_permissible_obligation: float
    max_affordable_new_emi: float
    is_eligible: bool


# ============================================================
# SARVAM AI TELEPHONY & WEBHOOK SCHEMAS
# ============================================================

class SarvamDeploymentRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    agent_name: str = Field(default="LoanVoiceAgent")
    system_prompt: Optional[str] = None
    language: Optional[str] = "te-IN"
    phone_number: Optional[str] = None
    webhook_url: Optional[str] = None
    telephony_provider: Optional[str] = "sarvam"
    metadata: Optional[Dict[str, Any]] = None


class SarvamOutboundCallRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    phone_number: str = Field(..., min_length=8, max_length=20, description="Target phone number with country code")
    lead_id: Optional[str] = None
    application_id: Optional[str] = None
    customer_name: Optional[str] = None
    language: Optional[str] = "te-IN"
    custom_variables: Optional[Dict[str, Any]] = None


class SarvamWebhookPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    event: Optional[str] = None
    call_id: Optional[str] = None
    sarvam_call_id: Optional[str] = None
    phone_number: Optional[str] = None
    status: Optional[str] = None
    duration: Optional[int] = None
    transcript: Optional[str] = None
    recording_url: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
