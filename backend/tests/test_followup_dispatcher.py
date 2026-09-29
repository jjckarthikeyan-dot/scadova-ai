import os
import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient

from backend.main import app
from backend.loan_agency.dispatcher import (
    process_post_call_followup,
    dispatch_due_followup_leads,
    AutomaticFollowupDispatcher
)

client = TestClient(app)


def test_post_call_followup_attempt_1():
    lead = {
        "id": 1,
        "retry_count": 0,
        "application_completed": False
    }
    now = datetime(2026, 9, 28, 12, 0, 0, tzinfo=timezone.utc)
    res = process_post_call_followup(lead, max_attempts=3, test_followup_minutes=5, now=now)

    assert res["retry_count"] == 1
    assert res["followup_required"] is True
    assert res["call_status"] == "followup_pending"
    assert res["lead_status"] == "application_pending"
    assert res["next_followup_at"] == (now + timedelta(minutes=5)).isoformat()
    assert res["followup_1_at"] == now.isoformat()
    assert res["followup_1_status"] == "attempted"
    assert "followup_2_at" not in res
    assert "followup_3_at" not in res


def test_post_call_followup_attempt_2():
    lead = {
        "id": 1,
        "retry_count": 1,
        "application_completed": False
    }
    now = datetime(2026, 9, 28, 12, 10, 0, tzinfo=timezone.utc)
    res = process_post_call_followup(lead, max_attempts=3, test_followup_minutes=5, now=now)

    assert res["retry_count"] == 2
    assert res["followup_required"] is True
    assert res["call_status"] == "followup_pending"
    assert res["lead_status"] == "application_pending"
    assert res["next_followup_at"] == (now + timedelta(minutes=5)).isoformat()
    assert res["followup_2_at"] == now.isoformat()
    assert res["followup_2_status"] == "attempted"
    assert "followup_1_at" not in res
    assert "followup_3_at" not in res


def test_post_call_followup_attempt_3_exhausted():
    lead = {
        "id": 1,
        "retry_count": 2,
        "application_completed": False
    }
    now = datetime(2026, 9, 28, 12, 20, 0, tzinfo=timezone.utc)
    res = process_post_call_followup(lead, max_attempts=3, test_followup_minutes=5, now=now)

    assert res["retry_count"] == 3
    assert res["followup_required"] is False
    assert res["next_followup_at"] is None
    assert res["call_status"] == "followup_exhausted"
    assert res["followup_3_at"] == now.isoformat()
    assert res["followup_3_status"] == "attempted"


@patch("backend.loan_agency.dispatcher.dispatch_lead_call")
def test_dispatch_due_followups_only_calls_when_conditions_met(mock_dispatch):
    """
    Tests dispatcher ONLY calls when:
      followup_required = true
      AND next_followup_at <= NOW()
      AND retry_count < 3
    """
    now = datetime.now(timezone.utc)
    due_time = (now - timedelta(minutes=1)).isoformat()

    # Mock leads from DB: one valid (retry_count 1), one exhausted (retry_count 3)
    mock_leads = [
        {
            "id": 101,
            "phone_number": "+919000000001",
            "followup_required": True,
            "next_followup_at": due_time,
            "retry_count": 1,
            "call_status": "followup_pending"
        },
        {
            "id": 102,
            "phone_number": "+919000000002",
            "followup_required": True,
            "next_followup_at": due_time,
            "retry_count": 3,  # Should NOT be called
            "call_status": "followup_pending"
        }
    ]

    mock_sb = MagicMock()
    mock_sb.table.return_value.select.return_value.eq.return_value.neq.return_value.lte.return_value.order.return_value.limit.return_value.execute.return_value.data = mock_leads

    async def fake_dispatch(lead, campaign_id, reason, supabase_client=None):
        return {"cohort_id": f"cohort_{lead['id']}", "status": "processing"}

    mock_dispatch.side_effect = fake_dispatch

    import asyncio
    result = asyncio.run(dispatch_due_followup_leads(campaign_id="test_camp", supabase_client=mock_sb))

    assert result["eligible_count"] == 1
    assert result["dispatched_count"] == 1
    assert result["dispatched"][0]["lead_id"] == 101
    mock_dispatch.assert_called_once()
    assert mock_dispatch.call_args[1]["lead"]["id"] == 101


def test_post_call_process_endpoint_incomplete_lead():
    mock_lead = {
        "id": 50,
        "phone_number": "+919032008111",
        "retry_count": 0,
        "application_completed": False,
        "lead_status": "new"
    }

    with patch("backend.loan_agency.sarvam_router.supabase") as mock_supabase:
        query_mock = MagicMock()
        query_mock.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [mock_lead]
        query_mock.update.return_value.eq.return_value.execute.return_value.data = [{**mock_lead, "retry_count": 1}]
        mock_supabase.table.return_value = query_mock

        response = client.post("/api/sarvam/outbound/post-call-process", json={"lead_id": 50})
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["is_application_completed"] is False
        assert data["update_data"]["retry_count"] == 1
        assert data["update_data"]["followup_required"] is True
        assert data["update_data"]["call_status"] == "followup_pending"
        assert data["update_data"]["followup_1_status"] == "attempted"


def test_post_call_process_endpoint_completed_lead():
    mock_lead = {
        "id": 51,
        "phone_number": "+919032008112",
        "retry_count": 1,
        "application_completed": True,
        "lead_status": "application_completed"
    }

    with patch("backend.loan_agency.sarvam_router.supabase") as mock_supabase:
        query_mock = MagicMock()
        query_mock.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = [mock_lead]
        query_mock.update.return_value.eq.return_value.execute.return_value.data = [mock_lead]
        mock_supabase.table.return_value = query_mock

        response = client.post("/api/sarvam/outbound/post-call-process", json={"lead_id": 51})
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["is_application_completed"] is True
        assert data["update_data"]["followup_required"] is False
        assert data["update_data"]["call_status"] == "completed"


def test_dispatcher_status_and_lifecycle_endpoints():
    response = client.get("/api/sarvam/outbound/dispatcher/status")
    assert response.status_code == 200
    data = response.json()
    assert "running" in data
    assert "interval_seconds" in data

    # Test stop and start
    stop_resp = client.post("/api/sarvam/outbound/dispatcher/stop")
    assert stop_resp.status_code == 200
    assert stop_resp.json()["status"]["running"] is False

    start_resp = client.post("/api/sarvam/outbound/dispatcher/start")
    assert start_resp.status_code == 200
    assert start_resp.json()["status"]["running"] is True

    # Cleanup stop
    client.post("/api/sarvam/outbound/dispatcher/stop")


@patch("backend.loan_agency.sarvam_router.run_outbound_dispatch")
def test_auto_dispatch_endpoint(mock_run_dispatch):
    async def fake_dispatch(campaign_id=None):
        return {"success": True, "lead_id": 10, "reason": "new_lead"}

    mock_run_dispatch.side_effect = fake_dispatch

    response = client.post("/outbound/auto-dispatch")
    assert response.status_code == 200
    assert response.json()["lead_id"] == 10
    mock_run_dispatch.assert_called_once()


def test_post_call_no_answer_daily_policy():
    now = datetime(2026, 9, 29, 10, 0, 0, tzinfo=timezone.utc)
    lead = {
        "id": 1,
        "retry_count": 0,
        "daily_retry_count": 0,
        "daily_retry_date": "2026-09-29"
    }

    # Attempt 1: Spaces by +4 hours
    res1 = process_post_call_followup(lead, now=now, call_outcome="no_answer")
    assert res1["daily_retry_count"] == 1
    assert res1["retry_required"] is True
    assert res1["next_retry_at"] == (now + timedelta(hours=4)).isoformat()
    assert res1["call_status"] == "retry_pending"

    # Attempt 2: Reaches daily retry limit -> schedules tomorrow
    lead["daily_retry_count"] = 1
    lead["retry_count"] = 1
    res2 = process_post_call_followup(lead, now=now + timedelta(hours=4), call_outcome="no_answer")
    assert res2["daily_retry_count"] == 2
    assert res2["retry_required"] is True
    assert res2["call_status"] == "daily_retry_limit_reached"


def test_post_call_terminal_policies():
    now = datetime.now(timezone.utc)
    lead = {"id": 2, "application_completed": True}

    res_comp = process_post_call_followup(lead, now=now, call_outcome="completed")
    assert res_comp["application_completed"] is True
    assert res_comp["followup_required"] is False
    assert res_comp["retry_required"] is False
    assert res_comp["lead_success"] is True

    res_dec = process_post_call_followup(lead, now=now, call_outcome="declined")
    assert res_dec["lead_status"] == "declined"
    assert res_dec["call_status"] == "declined"
    assert res_dec["followup_required"] is False
    assert res_dec["retry_required"] is False


@pytest.mark.asyncio
async def test_run_outbound_dispatch_priority_and_application_context():
    from backend.loan_agency.sarvam_router import run_outbound_dispatch

    now = datetime.now(timezone.utc)
    due_iso = (now - timedelta(minutes=5)).isoformat()

    # Lead 1: Incomplete application follow-up with existing context
    lead_followup = {
        "id": 201,
        "phone_number": "+919888800001",
        "full_name": "Deepak Sharma",
        "city": "Hyderabad",
        "preferred_language": "Telugu",
        "lead_status": "application_pending",
        "call_status": "followup_pending",
        "followup_required": True,
        "next_followup_at": due_iso,
        "latest_application_id": 105,
        "loan_type": "personal_loan",
        "last_completed_step": "employment_completed",
        "next_action": "complete_personal_loan_profile"
    }

    mock_sb = MagicMock()
    # Mock no callbacks, no reschedules, no technical retries, but an application follow-up
    def mock_table(name):
        t_mock = MagicMock()
        if name == "loan_leads":
            sel = MagicMock()
            sel.eq.return_value.neq.return_value.lte.return_value.order.return_value.limit.return_value.execute.return_value.data = []
            # When querying followup_required
            def eq_handler(col, val):
                eq_mock = MagicMock()
                if col == "callback_required":
                    eq_mock.neq.return_value.lte.return_value.order.return_value.limit.return_value.execute.return_value.data = []
                elif col == "reschedule_required":
                    eq_mock.neq.return_value.lte.return_value.order.return_value.limit.return_value.execute.return_value.data = []
                elif col == "retry_required":
                    eq_mock.in_.return_value.neq.return_value.lte.return_value.order.return_value.limit.return_value.execute.return_value.data = []
                    eq_mock.neq.return_value.lte.return_value.order.return_value.limit.return_value.execute.return_value.data = []
                elif col == "followup_required":
                    eq_mock.neq.return_value.lte.return_value.order.return_value.limit.return_value.execute.return_value.data = [lead_followup]
                return eq_mock
            t_mock.select.return_value.eq.side_effect = eq_handler
            t_mock.update.return_value.eq.return_value.execute.return_value.data = [{**lead_followup, "call_status": "queued"}]
        return t_mock

    mock_sb.table.side_effect = mock_table

    with patch("backend.loan_agency.sarvam_router.supabase", mock_sb), \
         patch("httpx.AsyncClient.post") as mock_http_post:
        mock_resp = MagicMock()
        mock_resp.is_error = False
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"cohort_id": "c_201", "status": "queued"}
        mock_http_post.return_value = mock_resp

        result = await run_outbound_dispatch(campaign_id="test_camp")

        assert result["success"] is True
        assert result["lead_id"] == 201
        assert result["reason"] == "application_followup"

        # Verify Sarvam HTTP payload received the application context
        mock_http_post.assert_called_once()
        sent_payload = mock_http_post.call_args[1]["json"]
        sent_user = sent_payload["users"][0]
        app_vars = sent_user["app_variables"]

        assert app_vars["application_id"] == "105"
        assert app_vars["loan_type"] == "personal_loan"
        assert app_vars["last_completed_step"] == "employment_completed"
        assert app_vars["next_action"] == "complete_personal_loan_profile"
        assert app_vars["call_reason"] == "application_followup"

