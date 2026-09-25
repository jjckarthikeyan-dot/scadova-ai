import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from backend.main import app
from backend.loan_agency.schemas import EmploymentProfileWithApplicationId, EmploymentType

client = TestClient(app)


def test_employment_schema_salary_fallback():
    # Verify gross_monthly_salary automatically sets net_monthly_salary if net is not provided
    payload = EmploymentProfileWithApplicationId(
        application_id=10,
        employment_type="salaried",
        company_name="Google",
        designation="Software Engineer",
        gross_monthly_salary=150000
    )
    dumped = payload.model_dump()
    assert dumped["application_id"] == 10
    assert dumped["net_monthly_salary"] == 150000.0


def test_employment_schema_allows_partial_voice_intake():
    # During Sarvam voice telephony calls, fields may arrive progressively
    payload = EmploymentProfileWithApplicationId(
        application_id=42,
        employment_type="salaried",
        company_name="TCS",
        gross_monthly_salary=80000
    )
    assert payload.application_id == 42
    assert payload.company_name == "TCS"


@patch("backend.loan_agency.router.supabase")
def test_save_employment_profile_from_body_endpoint(mock_supabase):
    # Mock ensure_application_exists check
    mock_select = MagicMock()
    mock_select.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [
        {"id": 42, "full_name": "Test User"}
    ]

    # Mock employment_profiles upsert
    mock_upsert = MagicMock()
    mock_upsert.upsert.return_value.execute.return_value.data = [
        {
            "id": 1,
            "application_id": 42,
            "employment_type": "salaried",
            "company_name": "Tech Corp",
            "designation": "Manager",
            "net_monthly_salary": 90000.0
        }
    ]

    def mock_table(table_name):
        if table_name == "loan_applications":
            return mock_select
        if table_name == "employment_profiles":
            return mock_upsert
        return MagicMock()

    mock_supabase.table.side_effect = mock_table

    # Test via /api/loan-agency/employment
    response = client.put(
        "/api/loan-agency/employment",
        json={
            "application_id": 42,
            "employment_type": "salaried",
            "company_name": "Tech Corp",
            "designation": "Manager",
            "gross_monthly_salary": 90000
        }
    )

    assert response.status_code == 200
    data = response.json()
    assert data["application_id"] == 42
    assert data["company_name"] == "Tech Corp"

    # Test via root alias /employment
    response_root = client.put(
        "/employment",
        json={
            "application_id": 42,
            "employment_type": "salaried",
            "company_name": "Tech Corp",
            "designation": "Manager",
            "gross_monthly_salary": 90000
        }
    )

    assert response_root.status_code == 200
    data_root = response_root.json()
    assert data_root["application_id"] == 42


def test_employment_schema_converts_empty_strings_to_none():
    # When voice telephony webhook passes empty strings for irrelevant fields,
    # they must be converted to None and not fail float/int parsing
    payload = EmploymentProfileWithApplicationId(
        application_id=42,
        employment_type="self_employed",
        business_name="Acme Corp",
        monthly_business_income=50000,
        company_name="",
        gross_monthly_salary="",
        net_monthly_salary="",
        business_start_year="",
        business_vintage_years=""
    )
    dumped = payload.model_dump()
    assert dumped["application_id"] == 42
    assert dumped["business_name"] == "Acme Corp"
    assert dumped["company_name"] is None
    assert dumped["gross_monthly_salary"] is None
    assert dumped["business_start_year"] is None
    assert dumped["business_vintage_years"] is None
