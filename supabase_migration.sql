-- Supabase Migration for Loan Agency & Sarvam Telephony Module
-- Run this in your Supabase SQL Editor

-- 1. Enable UUID generator extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Ensure base loan_applications table exists and has all required fields
CREATE TABLE IF NOT EXISTS loan_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_number TEXT UNIQUE,
    lead_id TEXT,
    applicant_name TEXT,
    full_name TEXT,
    phone_number TEXT,
    mobile_number TEXT,
    email TEXT,
    pan_number TEXT,
    aadhaar_number TEXT,
    product_type TEXT,
    loan_type TEXT,
    age INTEGER,
    city TEXT,
    preferred_language TEXT DEFAULT 'English',
    requested_amount NUMERIC,
    preferred_tenure_months INTEGER,
    loan_purpose TEXT,
    status TEXT DEFAULT 'DRAFT',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure columns exist in case loan_applications already was created previously
ALTER TABLE loan_applications
    ADD COLUMN IF NOT EXISTS application_number TEXT,
    ADD COLUMN IF NOT EXISTS lead_id TEXT,
    ADD COLUMN IF NOT EXISTS applicant_name TEXT,
    ADD COLUMN IF NOT EXISTS full_name TEXT,
    ADD COLUMN IF NOT EXISTS phone_number TEXT,
    ADD COLUMN IF NOT EXISTS mobile_number TEXT,
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS pan_number TEXT,
    ADD COLUMN IF NOT EXISTS aadhaar_number TEXT,
    ADD COLUMN IF NOT EXISTS product_type TEXT,
    ADD COLUMN IF NOT EXISTS loan_type TEXT,
    ADD COLUMN IF NOT EXISTS age INTEGER,
    ADD COLUMN IF NOT EXISTS city TEXT,
    ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'English',
    ADD COLUMN IF NOT EXISTS requested_amount NUMERIC,
    ADD COLUMN IF NOT EXISTS preferred_tenure_months INTEGER,
    ADD COLUMN IF NOT EXISTS loan_purpose TEXT,
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'DRAFT',
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3. Personal Loan Profiles Table
CREATE TABLE IF NOT EXISTS personal_loan_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID REFERENCES loan_applications(id) ON DELETE CASCADE UNIQUE,
    employment_type TEXT,
    company_name TEXT,
    designation TEXT,
    total_experience_years NUMERIC,
    company_joining_date DATE,
    previous_company_details TEXT,
    industry_type TEXT,
    gross_monthly_salary NUMERIC,
    net_monthly_salary NUMERIC,
    salary_credit_date INTEGER,
    annual_income NUMERIC,
    other_income NUMERIC,
    salary_bank_name TEXT,
    bank_statement_months INTEGER,
    salary_credits_consistent BOOLEAN,
    cheque_bounce_count INTEGER,
    emi_bounce_count INTEGER,
    average_monthly_balance NUMERIC,
    cibil_score INTEGER,
    existing_personal_loans TEXT,
    existing_personal_loan_emi NUMERIC,
    credit_card_outstanding NUMERIC,
    other_emis NUMERIC,
    total_monthly_emi NUMERIC,
    has_overdue_payments BOOLEAN,
    has_settlement BOOLEAN,
    has_writeoff BOOLEAN,
    requested_amount NUMERIC,
    loan_purpose TEXT,
    preferred_tenure_months INTEGER,
    balance_transfer_required BOOLEAN,
    pan_available BOOLEAN,
    aadhaar_kyc_available BOOLEAN,
    salary_slips_available BOOLEAN,
    bank_statements_available BOOLEAN,
    form16_itr_available BOOLEAN,
    employment_proof_available BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Used Car Loan Profiles Table
CREATE TABLE IF NOT EXISTS used_car_loan_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID REFERENCES loan_applications(id) ON DELETE CASCADE UNIQUE,
    employment_type TEXT,
    company_or_business_name TEXT,
    designation_or_business_nature TEXT,
    work_or_business_vintage NUMERIC,
    monthly_income NUMERIC,
    car_make TEXT,
    car_model TEXT,
    variant TEXT,
    manufacturing_year INTEGER,
    registration_year INTEGER,
    registration_number TEXT,
    fuel_type TEXT,
    transmission TEXT,
    current_owner_number INTEGER,
    kilometers_driven NUMERIC,
    insurance_validity TEXT,
    rc_status TEXT,
    accident_history TEXT,
    current_market_value NUMERIC,
    valuation_report_amount NUMERIC,
    expected_purchase_price NUMERIC,
    seller_type TEXT,
    cibil_score INTEGER,
    existing_loans TEXT,
    existing_emis NUMERIC,
    has_overdues_or_settlements BOOLEAN,
    required_loan_amount NUMERIC,
    down_payment NUMERIC,
    preferred_tenure_months INTEGER,
    refinance_required BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Business Loan Profiles Table
CREATE TABLE IF NOT EXISTS business_loan_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID REFERENCES loan_applications(id) ON DELETE CASCADE UNIQUE,
    business_name TEXT,
    business_type TEXT,
    business_start_year INTEGER,
    business_vintage_years NUMERIC,
    business_nature TEXT,
    business_address TEXT,
    gst_registered BOOLEAN,
    udyam_registered BOOLEAN,
    turnover_year_1 NUMERIC,
    turnover_year_2 NUMERIC,
    turnover_year_3 NUMERIC,
    current_financial_year_turnover NUMERIC,
    monthly_average_bank_credits NUMERIC,
    existing_business_loans TEXT,
    current_outstanding NUMERIC,
    monthly_emi_obligations NUMERIC,
    profit_or_net_income NUMERIC,
    cibil_score INTEGER,
    existing_loans_and_credit_cards TEXT,
    has_overdues BOOLEAN,
    has_settlements BOOLEAN,
    has_writeoffs BOOLEAN,
    requested_amount NUMERIC,
    loan_purpose TEXT,
    preferred_tenure_months INTEGER,
    liability_takeover_required BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Callbacks Table
CREATE TABLE IF NOT EXISTS callbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID REFERENCES loan_applications(id) ON DELETE SET NULL,
    lead_id TEXT,
    customer_name TEXT,
    phone_number TEXT NOT NULL,
    callback_date DATE,
    callback_time TIME,
    callback_datetime TIMESTAMPTZ,
    reason TEXT,
    status TEXT DEFAULT 'PENDING',
    attempt_count INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Call Sessions Table (Sarvam outbound / inbound sessions)
CREATE TABLE IF NOT EXISTS call_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id TEXT,
    application_id UUID REFERENCES loan_applications(id) ON DELETE SET NULL,
    sarvam_call_id TEXT UNIQUE,
    phone_number TEXT NOT NULL,
    direction TEXT DEFAULT 'outbound',
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    duration_seconds INTEGER,
    status TEXT DEFAULT 'initiated',
    transcript TEXT,
    recording_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Sarvam Webhooks Log Table
CREATE TABLE IF NOT EXISTS sarvam_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT,
    direction TEXT,
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_loan_applications_mobile ON loan_applications(phone_number, mobile_number);
CREATE INDEX IF NOT EXISTS idx_callbacks_status ON callbacks(status);
CREATE INDEX IF NOT EXISTS idx_call_sessions_sarvam_call_id ON call_sessions(sarvam_call_id);
