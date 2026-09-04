from typing import Optional
from pydantic import BaseModel


class PersonalLoanProfileResponse(BaseModel):
    id: Optional[str] = None
    application_id: str

    employment_type: Optional[str] = None
    company_name: Optional[str] = None
    designation: Optional[str] = None
    total_experience_years: Optional[float] = None
    company_joining_date: Optional[str] = None
    previous_company_details: Optional[str] = None
    industry_type: Optional[str] = None

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

    created_at: Optional[str] = None
    updated_at: Optional[str] = None