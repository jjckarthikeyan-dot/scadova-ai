-- ============================================================
-- Phase 2 Migration: Service & Appointment Booking + Admin Portal
-- Run this in your Supabase SQL Editor AFTER the existing migration
-- ============================================================

-- 0. Ensure UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. Extend businesses table for multi-type support
-- ============================================================
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_business_type_check;

ALTER TABLE businesses
    ADD COLUMN IF NOT EXISTS industry TEXT,
    ADD COLUMN IF NOT EXISTS country TEXT,
    ADD COLUMN IF NOT EXISTS address TEXT,
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS website TEXT,
    ADD COLUMN IF NOT EXISTS logo_url TEXT,
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS fish_agent_id TEXT,
    ADD COLUMN IF NOT EXISTS prompt_version_id INTEGER,
    ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Re-add permissive constraint supporting Service and Appointment Booking, Loan Agency, Restaurant, etc.
ALTER TABLE businesses ADD CONSTRAINT businesses_business_type_check 
    CHECK (business_type IN (
        'service_and_appointment', 
        'restaurant', 
        'loan_agency', 
        'clinic', 
        'custom',
        'Service and Appointment Booking',
        'Restaurant',
        'Loan Agency',
        'Custom'
    ));

-- ============================================================
-- 2. Services table (for Service & Appointment Booking)
-- ============================================================
CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    service_name TEXT NOT NULL,
    short_description TEXT,
    detailed_description TEXT,
    price NUMERIC(10, 2),
    duration_minutes INTEGER,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_services_business_id ON services(business_id);
CREATE INDEX IF NOT EXISTS idx_services_active ON services(business_id, active);

-- ============================================================
-- 3. Business Hours table
-- ============================================================
CREATE TABLE IF NOT EXISTS business_hours (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    day TEXT NOT NULL,
    open_time TEXT,
    close_time TEXT,
    closed BOOLEAN DEFAULT FALSE,
    holiday_hours TEXT,
    after_hours_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_hours_business_id ON business_hours(business_id);

-- ============================================================
-- 4. Appointments table
-- ============================================================
CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    appointment_id TEXT UNIQUE NOT NULL,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
    service_name TEXT,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    appointment_date DATE NOT NULL,
    appointment_time TEXT NOT NULL,
    duration_minutes INTEGER,
    status TEXT DEFAULT 'CONFIRMED',
    notes TEXT,
    source TEXT DEFAULT 'voice_agent',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_business_id ON appointments(business_id);
CREATE INDEX IF NOT EXISTS idx_appointments_appointment_id ON appointments(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointments_customer_phone ON appointments(customer_phone);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(business_id, appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(business_id, status);

-- ============================================================
-- 5. Voice Agents table
-- ============================================================
CREATE TABLE IF NOT EXISTS agents (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT,
    fish_agent_id TEXT,
    voice_id TEXT,
    voice_name TEXT,
    language TEXT DEFAULT 'en',
    accent TEXT,
    llm_provider TEXT,
    llm_model TEXT,
    first_message TEXT,
    prompt_version_id INTEGER,
    attached_tools JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agents_business_id ON agents(business_id);
CREATE INDEX IF NOT EXISTS idx_agents_fish_agent_id ON agents(fish_agent_id);

-- ============================================================
-- 6. Integrations table
-- ============================================================
CREATE TABLE IF NOT EXISTS integrations (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    connected BOOLEAN DEFAULT FALSE,
    config JSONB DEFAULT '{}'::jsonb,
    last_checked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integrations_business_id ON integrations(business_id);

-- ============================================================
-- 7. Prompt Versions table
-- ============================================================
CREATE TABLE IF NOT EXISTS prompt_versions (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
    version_number INTEGER NOT NULL,
    prompt_text TEXT NOT NULL,
    changed_fields JSONB,
    is_published BOOLEAN DEFAULT FALSE,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prompt_versions_business_id ON prompt_versions(business_id);
CREATE INDEX IF NOT EXISTS idx_prompt_versions_agent_id ON prompt_versions(agent_id);

-- ============================================================
-- 8. Call Logs table (extended for Phase 2)
-- ============================================================
CREATE TABLE IF NOT EXISTS call_logs (
    id SERIAL PRIMARY KEY,
    business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL,
    fish_agent_id TEXT,
    voice_provider TEXT,
    voice_id TEXT,
    voice_name TEXT,
    llm_provider TEXT,
    llm_model TEXT,
    prompt_version_id INTEGER REFERENCES prompt_versions(id) ON DELETE SET NULL,
    direction TEXT,
    caller TEXT,
    called_number TEXT,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    duration_seconds INTEGER,
    actual_minutes NUMERIC(8, 2),
    billable_minutes NUMERIC(8, 2),
    transcript TEXT,
    recording_url TEXT,
    summary TEXT,
    outcome TEXT,
    tool_calls JSONB DEFAULT '[]'::jsonb,
    appointment_ref TEXT,
    lead_ref TEXT,
    voice_cost NUMERIC(10, 4) DEFAULT 0,
    llm_cost NUMERIC(10, 4) DEFAULT 0,
    telephony_cost NUMERIC(10, 4) DEFAULT 0,
    total_cost NUMERIC(10, 4) DEFAULT 0,
    config_snapshot JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_call_logs_business_id ON call_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_agent_id ON call_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_start_time ON call_logs(start_time);

-- ============================================================
-- 9. Onboarding Drafts table (multi-step wizard)
-- ============================================================
CREATE TABLE IF NOT EXISTS onboarding_drafts (
    id SERIAL PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    current_step INTEGER DEFAULT 1,
    business_data JSONB DEFAULT '{}'::jsonb,
    hours_data JSONB DEFAULT '[]'::jsonb,
    services_data JSONB DEFAULT '[]'::jsonb,
    agent_data JSONB DEFAULT '{}'::jsonb,
    voice_data JSONB DEFAULT '{}'::jsonb,
    llm_data JSONB DEFAULT '{}'::jsonb,
    features_data JSONB DEFAULT '[]'::jsonb,
    rules_data JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 10. System Logs table
-- ============================================================
CREATE TABLE IF NOT EXISTS system_logs (
    id SERIAL PRIMARY KEY,
    level TEXT DEFAULT 'info',
    source TEXT,
    message TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at);

-- ============================================================
-- 11. Updated-at trigger function (reusable)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'services', 'appointments', 'agents', 'integrations', 'onboarding_drafts'
    ] LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS set_updated_at ON %I; CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
            tbl, tbl
        );
    END LOOP;
END;
$$;

-- ============================================================
-- 12. Row Level Security (RLS) — enable but allow service_role
-- ============================================================
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'services', 'business_hours', 'appointments', 'agents',
        'integrations', 'prompt_versions', 'call_logs',
        'onboarding_drafts', 'system_logs'
    ] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format(
            'DROP POLICY IF EXISTS service_role_all ON %I; CREATE POLICY service_role_all ON %I FOR ALL USING (true) WITH CHECK (true);',
            tbl, tbl
        );
    END LOOP;
END;
$$;
