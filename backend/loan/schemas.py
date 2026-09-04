from enum import Enum
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class ProductType(str, Enum):
    PERSONAL_LOAN = "PERSONAL_LOAN"
    BUSINESS_LOAN = "BUSINESS_LOAN"
    USED_CAR_LOAN = "USED_CAR_LOAN"


class LoanApplicationCreate(BaseModel):
    applicant_name: str = Field(..., min_length=2, max_length=100)
    phone_number: str = Field(..., min_length=10, max_length=20)

    email: Optional[EmailStr] = None
    pan_number: Optional[str] = None
    aadhaar_number: Optional[str] = None

    product_type: ProductType

    age: Optional[int] = Field(default=None, ge=18, le=100)
    city: Optional[str] = Field(default=None, max_length=100)


class LoanApplicationResponse(LoanApplicationCreate):
    id: str
    status: str

class PersonalLoanProfileUpdate(BaseModel):
    # Applicant / employment
    employment_type: Optional[str] = None

    company_name: Optional[str] = None
    designation: Optional[str] = None
    total_experience_years: Optional[float] = None
    company_joining_date: Optional[str] = None
    previous_company_details: Optional[str] = None
    industry_type: Optional[str] = None
    company_profile: Optional[str] = None

    # Income
    gross_monthly_salary: Optional[float] = None
    net_monthly_salary: Optional[float] = None
    salary_credit_date: Optional[int] = None
    annual_income: Optional[float] = None
    other_income: Optional[float] = None

    # Banking
    salary_bank_name: Optional[str] = None
    bank_statement_months: Optional[int] = None
    salary_credits_consistent: Optional[bool] = None
    cheque_bounce_count: Optional[int] = None
    emi_bounce_count: Optional[int] = None
    average_monthly_balance: Optional[float] = None

    # Credit
    cibil_score: Optional[int] = None
    existing_personal_loans: Optional[str] = None
    existing_personal_loan_emi: Optional[float] = None
    credit_card_outstanding: Optional[float] = None
    other_emis: Optional[float] = None
    total_monthly_emi: Optional[float] = None

    has_overdue_payments: Optional[bool] = None
    has_settlement: Optional[bool] = None
    has_writeoff: Optional[bool] = None

    # Requirement
    requested_amount: Optional[float] = None
    loan_purpose: Optional[str] = None
    preferred_tenure_months: Optional[int] = None
    balance_transfer_required: Optional[bool] = None

    # Documents availability
    pan_available: Optional[bool] = None
    aadhaar_kyc_available: Optional[bool] = None
    salary_slips_available: Optional[bool] = None
    bank_statements_available: Optional[bool] = None
    form16_itr_available: Optional[bool] = None
    employment_proof_available: Optional[bool] = None