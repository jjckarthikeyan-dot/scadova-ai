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


@patch("backend.loan_agency.router.supabase")
def test_get_application_by_mobile_success(mock_supabase):
    mock_query = MagicMock()
    mock_query.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = [
        {
            "id": 99,
            "full_name": "Ramesh Kumar",
            "mobile_number": "9032008222",
            "loan_type": "personal_loan",
            "created_at": "2026-09-24T12:00:00Z"
        }
    ]
    mock_supabase.table.return_value = mock_query

    # Test with formatted mobile number (dashes/spaces)
    response = client.get("/api/loan-agency/applications/mobile/903-200-8222")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == 99
    assert data["mobile_number"] == "9032008222"
    assert data["full_name"] == "Ramesh Kumar"


@patch("backend.loan_agency.router.supabase")
def test_get_application_by_mobile_not_found(mock_supabase):
    mock_query = MagicMock()
    mock_query.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = []
    mock_supabase.table.return_value = mock_query

    response = client.get("/api/loan-agency/applications/mobile/9999999999")
    assert response.status_code == 404
    assert "No application found" in response.json()["detail"]


@patch("backend.loan_agency.router.supabase")
def test_get_all_applications_by_mobile(mock_supabase):
    mock_query = MagicMock()
    mock_query.select.return_value.eq.return_value.order.return_value.execute.return_value.data = [
        {
            "id": 105,
            "full_name": "Priya Sharma",
            "mobile_number": "9876543210",
            "loan_type": "used_car_loan",
            "created_at": "2026-09-24T15:00:00Z"
        },
        {
            "id": 101,
            "full_name": "Priya Sharma",
            "mobile_number": "9876543210",
            "loan_type": "personal_loan",
            "created_at": "2026-09-20T10:00:00Z"
        }
    ]
    mock_supabase.table.return_value = mock_query

    response = client.get("/api/loan-agency/applications/mobile/9876543210/all")
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == 2
    assert len(data["applications"]) == 2
    assert data["applications"][0]["id"] == 105
    assert data["applications"][1]["id"] == 101


def test_sarvam_clean_base_model_integer_and_null_normalization():
    class DummyLoanModel(SarvamCleanBaseModel):
        application_id: int | None = None
        manufacturing_year: int | None = None
        registration_year: int | None = None
        current_owner_number: int | None = None
        kilometers_driven: int | None = None
        cibil_score: int | None = None
        preferred_tenure_months: int | None = None
        business_start_year: int | None = None
        city: str | None = None

    payload = DummyLoanModel.model_validate({
        "application_id": "105.0",
        "manufacturing_year": 2019.0,
        "registration_year": "2020",
        "current_owner_number": "1",
        "kilometers_driven": "45000.5",
        "cibil_score": "750",
        "preferred_tenure_months": 36.0,
        "business_start_year": "2018",
        "city": "N/A"
    })

    assert payload.application_id == 105
    assert payload.manufacturing_year == 2019
    assert payload.registration_year == 2020
    assert payload.current_owner_number == 1
    assert payload.kilometers_driven == 45000
    assert payload.cibil_score == 750
    assert payload.preferred_tenure_months == 36
    assert payload.business_start_year == 2018
    assert payload.city is None

    null_cases = DummyLoanModel.model_validate({
        "application_id": "null",
        "manufacturing_year": "none",
        "registration_year": "na",
        "cibil_score": "unknown",
        "city": "   "
    })
    assert null_cases.application_id is None
    assert null_cases.manufacturing_year is None
    assert null_cases.registration_year is None
    assert null_cases.cibil_score is None
    assert null_cases.city is None

