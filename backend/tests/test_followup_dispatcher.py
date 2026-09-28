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

