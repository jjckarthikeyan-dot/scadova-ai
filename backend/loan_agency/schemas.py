from enum import Enum
from typing import Any, Dict, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator


# ============================================================
# ENUMS
# ============================================================

class LoanType(str, Enum):
    PERSONAL_LOAN = "personal_loan"
    BUSINESS_LOAN = "business_loan"
    USED_CAR_LOAN = "used_car_loan"


class EmploymentType(str, Enum):
    SALARIED = "salaried"
    SELF_EMPLOYED = "self_employed"


# ============================================================
# LOAN APPLICATION SCHEMAS
# ============================================================

class LoanApplicationCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    loan_type: str = Field(
        ...,
        description="personal_loan, business_loan, or used_car_loan"
    )

    full_name: str = Field(
        ...,
        min_length=2,
        max_length=150,
        description="Applicant full name"
    )

    mobile_number: str = Field(
        ...,
        min_length=8,
        max_length=20,
        description="Applicant mobile number"
    )

    age: Optional[int] = Field(
        default=None,
        ge=18,
        le=100
    )

    city: Optional[str] = Field(
        default=None,
        max_length=100
    )

    preferred_language: Optional[str] = Field(
        default="Telugu"
    )

    source: Optional[str] = Field(
        default="voice_agent",
        description="Application source"
    )

    # Sarvam call identifier.
    # IMPORTANT:
    # This is NOT the database application_id.
    sarvam_interaction_id: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Sarvam Interaction ID for the voice call"
    )

    email: Optional[str] = None
    pan_number: Optional[str] = None
    aadhaar_number: Optional[str] = None

    requested_amount: Optional[float] = Field(
        default=None,
        ge=0
    )

    preferred_tenure_months: Optional[int] = Field(
        default=None,
        gt=0,
        le=360
    )

    loan_purpose: Optional[str] = None


class LoanApplicationResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    # Supabase / database application ID.
    # This is the ID every child table must use.
    id: int

    application_number: Optional[str] = None

    loan_type: Optional[str] = None
    full_name: Optional[str] = None
    mobile_number: Optional[str] = None
    age: Optional[int] = None
    city: Optional[str] = None
    preferred_language: Optional[str] = None
    source: Optional[str] = None

    sarvam_interaction_id: Optional[str] = None

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
# COMMON EMPLOYMENT PROFILE
# ============================================================

class EmploymentProfileUpdate(BaseModel):
    """
    Common employment/income profile shared by:
    - Personal Loan
    - Business Loan
    - Used Car Loan

    employment_type controls which set of fields is expected.
    """

    model_config = ConfigDict(extra="ignore")

    employment_type: EmploymentType

    # --------------------------------------------------------
    # SALARIED FIELDS
    # --------------------------------------------------------

    company_name: Optional[str] = None
    designation: Optional[str] = None
    industry_type: Optional[str] = None

    total_experience_years: Optional[float] = Field(
        default=None,
        ge=0
    )

    company_joining_date: Optional[str] = None

    gross_monthly_salary: Optional[float] = Field(
        default=None,
        ge=0
    )

    net_monthly_salary: Optional[float] = Field(
        default=None,
        ge=0
    )

    annual_income: Optional[float] = Field(
        default=None,
        ge=0
    )

    salary_bank_name: Optional[str] = None

    # --------------------------------------------------------
    # SELF-EMPLOYED FIELDS
    # --------------------------------------------------------

    business_name: Optional[str] = None
    business_nature: Optional[str] = None

    business_start_year: Optional[int] = Field(
        default=None,
        ge=1900,
        le=2100
    )

    business_vintage_years: Optional[float] = Field(
        default=None,
        ge=0
    )

    monthly_business_income: Optional[float] = Field(
        default=None,
        ge=0
    )

    # --------------------------------------------------------
    # CONDITIONAL VALIDATION
    # --------------------------------------------------------

    @model_validator(mode="after")
    def validate_employment_details(self):
        """
        Keep this intentionally moderate for voice-agent usage.

        We enforce the minimum key fields while allowing the agent
        to save the profile incrementally if needed later.
        """

        if self.employment_type == EmploymentType.SALARIED:

            if self.net_monthly_salary is None and self.gross_monthly_salary is not None:
                self.net_monthly_salary = self.gross_monthly_salary

            missing = []

            if not self.company_name:
                missing.append("company_name")

            if not self.designation:
                missing.append("designation")

            if self.net_monthly_salary is None:
                missing.append("net_monthly_salary")

            if missing:
                raise ValueError(
                    "For salaried employment, required fields are: "
                    + ", ".join(missing)
                )

        elif self.employment_type == EmploymentType.SELF_EMPLOYED:

            missing = []

            if not self.business_name:
                missing.append("business_name")

            if not self.business_nature:
                missing.append("business_nature")

            if self.monthly_business_income is None:
                missing.append("monthly_business_income")

            if missing:
                raise ValueError(
                    "For self-employed applicants, required fields are: "
                    + ", ".join(missing)
                )

        return self


class SarvamCleanBaseModel(BaseModel):
    """
    Reusable base model for voice telephony agents (Sarvam AI / Fish Audio / Retell)
    that normalizes empty strings, string nulls, and coerced numeric values before validation,
    preventing 422 Unprocessable Entity errors on optional numeric, boolean, or date fields.
    Preserves legitimate 0, 0.0, and False values.
    """
    model_config = ConfigDict(extra="ignore")

    @model_validator(mode="before")
    @classmethod
    def normalize_values(cls, data):
        if not isinstance(data, dict):
            return data

        integer_fields = {
            "application_id",
            "manufacturing_year",
            "registration_year",
            "current_owner_number",
            "kilometers_driven",
            "cibil_score",
            "preferred_tenure_months",
            "business_start_year",
        }

        cleaned = {}
        for key, value in data.items():
            if isinstance(value, str):
                value = value.strip()
                if value.lower() in {
                    "",
                    "none",
                    "null",
                    "n/a",
                    "na",
                    "unknown",
                }:
                    cleaned[key] = None
                    continue

            if key in integer_fields and value is not None:
                try:
                    cleaned[key] = int(float(value))
                    continue
                except (ValueError, TypeError):
                    pass

            cleaned[key] = value

        return cleaned


class EmploymentProfileWithApplicationId(SarvamCleanBaseModel):
    """
    Employment profile schema specifically designed for Sarvam AI voice tools/webhooks,
    where application_id is provided directly in the request body.
    Converts blank strings to None before validation so both salaried and self-employed
    fields can be submitted flexibly via a single webhook tool.
    """
    application_id: int
    employment_type: str

    company_name: Optional[str] = None
    designation: Optional[str] = None
    industry_type: Optional[str] = None
    total_experience_years: Optional[float] = None
    company_joining_date: Optional[str] = None
    gross_monthly_salary: Optional[float] = None
    net_monthly_salary: Optional[float] = None
    annual_income: Optional[float] = None
    salary_bank_name: Optional[str] = None

    business_name: Optional[str] = None
    business_nature: Optional[str] = None
    business_start_year: Optional[int] = None
    business_vintage_years: Optional[float] = None
    monthly_business_income: Optional[float] = None

    @model_validator(mode="after")
    def sync_salaries(self):
        if self.net_monthly_salary is None and self.gross_monthly_salary is not None:
            self.net_monthly_salary = self.gross_monthly_salary
        return self


class EmploymentProfileResponse(EmploymentProfileUpdate):
    model_config = ConfigDict(extra="ignore")

    id: Optional[int] = None

    # IMPORTANT:
    # Always database loan_applications.id
    application_id: int

    created_at: Optional[str] = None
    updated_at: Optional[str] = None


# ============================================================
# PERSONAL LOAN PROFILE SCHEMAS
# ============================================================

class PersonalLoanProfileUpdate(SarvamCleanBaseModel):
    # --------------------------------------------------------
    # Existing employment fields
    #
    # Keep temporarily for backward compatibility.
    # New system should primarily use employment_profiles.
    # --------------------------------------------------------

    employment_type: Optional[str] = None
    company_name: Optional[str] = None
    designation: Optional[str] = None

    total_experience_years: Optional[float] = Field(
        default=None,
        ge=0
    )

    company_joining_date: Optional[str] = None
    previous_company_details: Optional[str] = None
    industry_type: Optional[str] = None
    company_profile: Optional[str] = None

    gross_monthly_salary: Optional[float] = Field(
        default=None,
        ge=0
    )

    net_monthly_salary: Optional[float] = Field(
        default=None,
        ge=0
    )

    salary_credit_date: Optional[int] = Field(
        default=None,
        ge=1,
        le=31
    )

    annual_income: Optional[float] = Field(
        default=None,
        ge=0
    )

    other_income: Optional[float] = Field(
        default=None,
        ge=0
    )

    # --------------------------------------------------------
    # BANKING
    # --------------------------------------------------------

    salary_bank_name: Optional[str] = None

    bank_statement_months: Optional[int] = Field(
        default=None,
        ge=0,
        le=60
    )

    salary_credits_consistent: Optional[bool] = None

    cheque_bounce_count: Optional[int] = Field(
        default=None,
        ge=0
    )

    emi_bounce_count: Optional[int] = Field(
        default=None,
        ge=0
    )

    average_monthly_balance: Optional[float] = Field(
        default=None,
        ge=0
    )

    # --------------------------------------------------------
    # CREDIT PROFILE
    # --------------------------------------------------------

    cibil_score: Optional[int] = Field(
        default=None,
        ge=300,
        le=900
    )

    existing_personal_loans: Optional[str] = None

    existing_personal_loan_emi: Optional[float] = Field(
        default=None,
        ge=0
    )

    credit_card_outstanding: Optional[float] = Field(
        default=None,
        ge=0
    )

    other_emis: Optional[float] = Field(
        default=None,
        ge=0
    )

    total_monthly_emi: Optional[float] = Field(
        default=None,
        ge=0
    )

    has_overdue_payments: Optional[bool] = None
    has_settlement: Optional[bool] = None
    has_writeoff: Optional[bool] = None

    # --------------------------------------------------------
    # LOAN REQUIREMENT
    # --------------------------------------------------------

    requested_amount: Optional[float] = Field(
        default=None,
        ge=0
    )

    loan_purpose: Optional[str] = None

    preferred_tenure_months: Optional[int] = Field(
        default=None,
        gt=0,
        le=360
    )

    balance_transfer_required: Optional[bool] = None

    # --------------------------------------------------------
    # DOCUMENT AVAILABILITY
    # --------------------------------------------------------

    pan_available: Optional[bool] = None
    aadhaar_kyc_available: Optional[bool] = None
    salary_slips_available: Optional[bool] = None
    bank_statements_available: Optional[bool] = None
    form16_itr_available: Optional[bool] = None
    employment_proof_available: Optional[bool] = None


class PersonalLoanProfileResponse(PersonalLoanProfileUpdate):
    model_config = ConfigDict(extra="ignore")

    id: Optional[int] = None

    # Standardized numeric application ID
    application_id: int

    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class PersonalLoanProfileWithApplicationId(PersonalLoanProfileUpdate):
    """
    Personal Loan profile schema for Sarvam AI telephony tools/webhooks,
    where application_id is provided directly in the request body.
    """
    application_id: int


# ============================================================
# USED CAR LOAN PROFILE SCHEMAS
# ============================================================

class UsedCarLoanProfileUpdate(SarvamCleanBaseModel):
    # --------------------------------------------------------
    # TEMPORARY BACKWARD-COMPATIBLE EMPLOYMENT FIELDS
    #
    # New architecture should use employment_profiles.
    # --------------------------------------------------------

    employment_type: Optional[str] = None
    company_or_business_name: Optional[str] = None
    designation_or_business_nature: Optional[str] = None

    work_or_business_vintage: Optional[float] = Field(
        default=None,
        ge=0
    )

    monthly_income: Optional[float] = Field(
        default=None,
        ge=0
    )

    # --------------------------------------------------------
    # VEHICLE DETAILS
    # --------------------------------------------------------

    car_make: Optional[str] = None
    car_model: Optional[str] = None
    variant: Optional[str] = None

    manufacturing_year: Optional[int] = Field(
        default=None,
        ge=1900,
        le=2100
    )

    registration_year: Optional[int] = Field(
        default=None,
        ge=1900,
        le=2100
    )

    registration_number: Optional[str] = None
    fuel_type: Optional[str] = None
    transmission: Optional[str] = None

    current_owner_number: Optional[int] = Field(
        default=None,
        ge=1
    )

    kilometers_driven: Optional[float] = Field(
        default=None,
        ge=0
    )

    insurance_validity: Optional[str] = None
    rc_status: Optional[str] = None
    accident_history: Optional[str] = None

    # --------------------------------------------------------
    # VEHICLE VALUATION
    # --------------------------------------------------------

    current_market_value: Optional[float] = Field(
        default=None,
        ge=0
    )

    valuation_report_amount: Optional[float] = Field(
        default=None,
        ge=0
    )

    expected_purchase_price: Optional[float] = Field(
        default=None,
        ge=0
    )

    seller_type: Optional[str] = None

    # --------------------------------------------------------
    # CREDIT PROFILE
    # --------------------------------------------------------

    cibil_score: Optional[int] = Field(
        default=None,
        ge=300,
        le=900
    )

    existing_loans: Optional[str] = None

    existing_emis: Optional[float] = Field(
        default=None,
        ge=0
    )

    has_overdues_or_settlements: Optional[bool] = None

    # --------------------------------------------------------
    # LOAN REQUIREMENT
    # --------------------------------------------------------

    required_loan_amount: Optional[float] = Field(
        default=None,
        ge=0
    )

    down_payment: Optional[float] = Field(
        default=None,
        ge=0
    )

    preferred_tenure_months: Optional[int] = Field(
        default=None,
        gt=0,
        le=360
    )

    refinance_required: Optional[bool] = None


class UsedCarLoanProfileResponse(UsedCarLoanProfileUpdate):
    model_config = ConfigDict(extra="ignore")

    id: Optional[int] = None

    # FIXED:
    # previously str
    application_id: int

    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class UsedCarLoanProfileWithApplicationId(UsedCarLoanProfileUpdate):
    """
    Used Car Loan profile schema for Sarvam AI telephony tools/webhooks,
    where application_id is provided directly in the request body.
    """
    application_id: int


# ============================================================
# BUSINESS LOAN PROFILE SCHEMAS
# ============================================================

class BusinessLoanProfileUpdate(SarvamCleanBaseModel):
    # --------------------------------------------------------
    # BUSINESS DETAILS
    # --------------------------------------------------------

    business_name: Optional[str] = None
    business_type: Optional[str] = None

    business_start_year: Optional[int] = Field(
        default=None,
        ge=1900,
        le=2100
    )

    business_vintage_years: Optional[float] = Field(
        default=None,
        ge=0
    )

    business_nature: Optional[str] = None
    business_address: Optional[str] = None

    gst_registered: Optional[bool] = None
    udyam_registered: Optional[bool] = None

    # --------------------------------------------------------
    # FINANCIAL DETAILS
    # --------------------------------------------------------

    turnover_year_1: Optional[float] = Field(
        default=None,
        ge=0
    )

    turnover_year_2: Optional[float] = Field(
        default=None,
        ge=0
    )

    turnover_year_3: Optional[float] = Field(
        default=None,
        ge=0
    )

    current_financial_year_turnover: Optional[float] = Field(
        default=None,
        ge=0
    )

    monthly_average_bank_credits: Optional[float] = Field(
        default=None,
        ge=0
    )

    existing_business_loans: Optional[str] = None

    current_outstanding: Optional[float] = Field(
        default=None,
        ge=0
    )

    monthly_emi_obligations: Optional[float] = Field(
        default=None,
        ge=0
    )

    profit_or_net_income: Optional[float] = None

    # --------------------------------------------------------
    # CREDIT PROFILE
    # --------------------------------------------------------

    cibil_score: Optional[int] = Field(
        default=None,
        ge=300,
        le=900
    )

    existing_loans_and_credit_cards: Optional[str] = None

    has_overdues: Optional[bool] = None
    has_settlements: Optional[bool] = None
    has_writeoffs: Optional[bool] = None

    # --------------------------------------------------------
    # LOAN REQUIREMENT
    # --------------------------------------------------------

    requested_amount: Optional[float] = Field(
        default=None,
        ge=0
    )

    loan_purpose: Optional[str] = None

    preferred_tenure_months: Optional[int] = Field(
        default=None,
        gt=0,
        le=360
    )

    liability_takeover_required: Optional[bool] = None


class BusinessLoanProfileResponse(BusinessLoanProfileUpdate):
    model_config = ConfigDict(extra="ignore")

    id: Optional[int] = None

    # FIXED:
    # previously str
    application_id: int

    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class BusinessLoanProfileWithApplicationId(BusinessLoanProfileUpdate):
    """
    Business Loan profile schema for Sarvam AI telephony tools/webhooks,
    where application_id is provided directly in the request body.
    """
    application_id: int


# ============================================================
# CALLBACK SCHEMAS
# ============================================================

class CallbackCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    # FIXED:
    # same numeric database application ID
    application_id: Optional[int] = None

    lead_id: Optional[str] = None
    customer_name: Optional[str] = None

    phone_number: str = Field(
        ...,
        min_length=8,
        max_length=20
    )

    callback_date: Optional[str] = None
    callback_time: Optional[str] = None
    callback_datetime: Optional[str] = None

    reason: Optional[str] = None
    notes: Optional[str] = None

    status: Optional[str] = "PENDING"


class CallbackResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str

    application_id: Optional[int] = None

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
# EMI CALCULATOR
# ============================================================

class EMICalculatorRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    principal: float = Field(
        ...,
        gt=0,
        description="Loan principal amount in INR"
    )

    annual_rate: float = Field(
        ...,
        ge=0,
        le=100,
        description="Annual interest rate percentage"
    )

    tenure_months: int = Field(
        ...,
        gt=0,
        le=360
    )


class EMICalculatorResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    principal: float
    annual_rate: float
    tenure_months: int

    monthly_emi: float
    total_interest: float
    total_payment: float


# ============================================================
# FOIR CALCULATOR
# ============================================================

class FOIRCalculatorRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    net_monthly_income: float = Field(
        ...,
        gt=0
    )

    existing_monthly_obligations: float = Field(
        default=0.0,
        ge=0
    )

    proposed_emi: float = Field(
        default=0.0,
        ge=0
    )

    foir_threshold_percentage: float = Field(
        default=50.0,
        gt=0,
        le=100
    )


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
# SARVAM AI TELEPHONY / VOICE AGENT SCHEMAS
# ============================================================

class SarvamDeploymentRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    agent_name: str = Field(
        default="LoanVoiceAgent"
    )

    system_prompt: Optional[str] = None

    language: Optional[str] = "te-IN"

    phone_number: Optional[str] = None

    webhook_url: Optional[str] = None

    telephony_provider: Optional[str] = "sarvam"

    metadata: Optional[Dict[str, Any]] = None


class SarvamOutboundCallRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    phone_number: str = Field(
        ...,
        min_length=8,
        max_length=20,
        description="Target phone number with country code"
    )

    lead_id: Optional[str] = None

    # FIXED:
    # database application ID must be numeric
    application_id: Optional[int] = None

    customer_name: Optional[str] = None

    language: Optional[str] = "te-IN"

    custom_variables: Optional[Dict[str, Any]] = None


class SarvamWebhookPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    event: Optional[str] = None

    # Sarvam-generated call/interaction identifiers.
    # These are NOT loan application IDs.
    call_id: Optional[str] = None
    sarvam_call_id: Optional[str] = None
    interaction_id: Optional[str] = None

    phone_number: Optional[str] = None

    status: Optional[str] = None
    duration: Optional[int] = None

    transcript: Optional[str] = None
    recording_url: Optional[str] = None

    data: Optional[Dict[str, Any]] = None
