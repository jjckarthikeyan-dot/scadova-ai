import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from backend.main import app
from backend.loan_agency.schemas import (
    EmploymentProfileWithApplicationId,
    PersonalLoanProfileWithApplicationId,
    BusinessLoanProfileWithApplicationId,
    UsedCarLoanProfileWithApplicationId,
    SarvamCleanBaseModel,
    EmploymentType
)

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
    # When voice telephony webhook passes empty or whitespace strings for irrelevant fields,
    # they must be converted to None and not fail float/int parsing
    payload = EmploymentProfileWithApplicationId(
        application_id=42,
        employment_type="self_employed",
        business_name="Acme Corp",
        monthly_business_income=50000,
        company_name="",
        gross_monthly_salary="   ",
        net_monthly_salary="",
        business_start_year="",
        business_vintage_years="  "
    )
    dumped = payload.model_dump(exclude_none=True)
    assert dumped["application_id"] == 42
    assert dumped["business_name"] == "Acme Corp"
    assert "company_name" not in dumped
    assert "gross_monthly_salary" not in dumped
    assert "business_start_year" not in dumped


def test_sarvam_clean_base_model_preserves_zero_and_false():
    class DummyModel(SarvamCleanBaseModel):
        credit_card_outstanding: float | None = None
        existing_personal_loan_emi: float | None = None
        has_settlement: bool | None = None
        city: str | None = None
        empty_field: str | None = None
        whitespace_field: str | None = None

    instance = DummyModel(
        credit_card_outstanding=0,
        existing_personal_loan_emi=0.0,
        has_settlement=False,
        city="Hyderabad",
        empty_field="",
        whitespace_field="   "
    )
    dumped = instance.model_dump()
    assert dumped["credit_card_outstanding"] == 0.0
    assert dumped["existing_personal_loan_emi"] == 0.0
    assert dumped["has_settlement"] is False
    assert dumped["city"] == "Hyderabad"
    assert dumped["empty_field"] is None
    assert dumped["whitespace_field"] is None

    # When exclude_none=True, only None values are omitted; 0 and False remain
    clean_dump = instance.model_dump(exclude_none=True)
    assert clean_dump["credit_card_outstanding"] == 0.0
    assert clean_dump["has_settlement"] is False
    assert clean_dump["city"] == "Hyderabad"
    assert "empty_field" not in clean_dump
    assert "whitespace_field" not in clean_dump


def test_personal_loan_with_application_id_normalization():
    payload = PersonalLoanProfileWithApplicationId(
        application_id=101,
        credit_card_outstanding=0,
        existing_personal_loan_emi="",
        has_settlement=False,
        has_overdue_payments="  ",
        requested_amount=500000
    )
    assert payload.application_id == 101
    assert payload.credit_card_outstanding == 0.0
    assert payload.existing_personal_loan_emi is None
    assert payload.has_settlement is False
    assert payload.has_overdue_payments is None
    assert payload.requested_amount == 500000.0


def test_business_and_used_car_loan_normalization():
    biz = BusinessLoanProfileWithApplicationId(
        application_id=202,
        business_start_year="",
        profit_or_net_income="  ",
        gst_registered=False,
        current_outstanding=0
    )
    assert biz.application_id == 202
    assert biz.business_start_year is None
    assert biz.profit_or_net_income is None
    assert biz.gst_registered is False
    assert biz.current_outstanding == 0.0

    car = UsedCarLoanProfileWithApplicationId(
        application_id=303,
        manufacturing_year="",
        kilometers_driven=0,
        current_market_value="   ",
        down_payment=50000
    )
    assert car.application_id == 303
    assert car.manufacturing_year is None
    assert car.kilometers_driven == 0.0
    assert car.current_market_value is None
    assert car.down_payment == 50000.0
