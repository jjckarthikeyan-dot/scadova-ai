import os
import sys
import logging
import asyncio
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, List
import httpx
from fastapi import HTTPException, status

logger = logging.getLogger("loan_agency.dispatcher")

MAX_ATTEMPTS = int(os.getenv("MAX_ATTEMPTS", "3"))
TEST_FOLLOWUP_MINUTES = int(os.getenv("TEST_FOLLOWUP_MINUTES", "1"))
DISPATCHER_INTERVAL_SECONDS = int(os.getenv("DISPATCHER_INTERVAL_SECONDS", "60"))

SARVAM_BASE_URL = os.getenv("SARVAM_BASE_URL", "https://apps.sarvam.ai/api")
SARVAM_ORG_ID = os.getenv("SARVAM_ORG_ID", "019fea16-96c0-705a-88f5-819f95459cc4")
SARVAM_WORKSPACE_ID = os.getenv("SARVAM_WORKSPACE_ID", "019fea16-96c4-78cd-975e-ee5c73089f99")
SARVAM_CAMPAIGN_ID = os.getenv("SARVAM_CAMPAIGN_ID", "MKN-Loan-Le-181e5d84-a3cc")


def get_supabase():
    """
    Returns Supabase client, prioritizing sarvam_router.supabase
    so that unit test patches on sarvam_router.supabase work seamlessly.
    """
    try:
        import backend.loan_agency.sarvam_router as sr
        if hasattr(sr, "supabase"):
            return sr.supabase
    except Exception:
        pass
    from backend.core.supabase import supabase
    return supabase


def process_post_call_followup(
    lead: Dict[str, Any],
    max_attempts: int = MAX_ATTEMPTS,
    test_followup_minutes: int = TEST_FOLLOWUP_MINUTES,
    now: Optional[datetime] = None
) -> Dict[str, Any]:
    """
    After each call, if the application is still incomplete:
    attempt = (lead.get("retry_count") or 0) + 1
    if attempt < MAX_ATTEMPTS:
        next_time = datetime.now(timezone.utc) + timedelta(minutes=TEST_FOLLOWUP_MINUTES)
        update_data = {
            "retry_count": attempt,
            "followup_required": True,
            "next_followup_at": next_time.isoformat(),
            "call_status": "followup_pending",
            "lead_status": "application_pending"
        }
    else:
        update_data = {
            "retry_count": attempt,
            "followup_required": False,
            "next_followup_at": None,
            "call_status": "followup_exhausted"
        }

    Also record each attempt:
    if attempt == 1:
        update_data["followup_1_at"] = datetime.now(timezone.utc).isoformat()
        update_data["followup_1_status"] = "attempted"
    elif attempt == 2:
        update_data["followup_2_at"] = datetime.now(timezone.utc).isoformat()
        update_data["followup_2_status"] = "attempted"
    elif attempt == 3:
        update_data["followup_3_at"] = datetime.now(timezone.utc).isoformat()
        update_data["followup_3_status"] = "attempted"
    """
    if now is None:
        now = datetime.now(timezone.utc)

    attempt = (lead.get("retry_count") or 0) + 1

    if attempt < max_attempts:
        next_time = now + timedelta(minutes=test_followup_minutes)
        update_data = {
            "retry_count": attempt,
            "followup_required": True,
            "next_followup_at": next_time.isoformat(),
            "call_status": "followup_pending",
            "lead_status": "application_pending"
        }
    else:
        update_data = {
            "retry_count": attempt,
            "followup_required": False,
            "next_followup_at": None,
            "call_status": "followup_exhausted"
        }

    # Also record each attempt
    if attempt == 1:
        update_data["followup_1_at"] = now.isoformat()
        update_data["followup_1_status"] = "attempted"
    elif attempt == 2:
        update_data["followup_2_at"] = now.isoformat()
        update_data["followup_2_status"] = "attempted"
    elif attempt == 3:
        update_data["followup_3_at"] = now.isoformat()
        update_data["followup_3_status"] = "attempted"

    return update_data


async def dispatch_lead_call(
    lead: Dict[str, Any],
    campaign_id: Optional[str] = None,
    reason: str = "followup",
    supabase_client: Optional[Any] = None
) -> Dict[str, Any]:
    """
    Streams a single lead to Sarvam AI campaign cohort and updates status to queued.
    """
    sb = supabase_client or get_supabase()
    api_key = os.getenv("SARVAM_VOICE_AGENT_API_KEY") or os.getenv("SARVAM_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SARVAM_VOICE_AGENT_API_KEY is not configured"
        )

    target_campaign_id = campaign_id or os.getenv("SARVAM_CAMPAIGN_ID") or SARVAM_CAMPAIGN_ID
    if not target_campaign_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No campaign_id provided and SARVAM_CAMPAIGN_ID is not configured"
        )

    phone = lead.get("phone_number")
    if not phone:
        return {
            "success": False,
            "message": f"Lead {lead.get('id')} has no valid phone number",
            "lead_id": lead.get("id"),
            "reason": reason
        }

    now = datetime.now(timezone.utc)

    app_variables = {
        "lead_id": str(lead["id"]),
        "full_name": lead.get("full_name") or "",
        "phone_number": lead.get("phone_number") or "",
        "city": lead.get("city") or "",
        "preferred_language": lead.get("preferred_language") or "",
        "lead_status": lead.get("lead_status") or "new"
    }

    user = {
        "user_phone_number": phone,
        "user_identifier": str(lead["id"]),
        "app_variables": app_variables
    }

    if lead.get("preferred_language"):
        user["app_overrides"] = {
            "initial_language_name": lead["preferred_language"]
        }

    url = (
        f"{SARVAM_BASE_URL}/scheduling/v1/"
        f"orgs/{SARVAM_ORG_ID}/"
        f"workspaces/{SARVAM_WORKSPACE_ID}/"
        f"campaigns/{target_campaign_id}/cohorts/stream"
    )

    payload = {
        "name": f"auto-lead-{lead['id']}",
        "users": [user]
    }

    headers = {
        "X-API-Key": api_key,
        "Content-Type": "application/json"
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            response = await http_client.post(
                url,
                json=payload,
                headers=headers
            )

            # If 422 indicates variables not found in the agent, gracefully retry without unconfigured variable(s)
            if response.status_code == 422 and "not found in the agent's variables:" in response.text:
                logger.warning(f"Sarvam rejected app_variables: {response.text}. Retrying with supported variables.")
                m = re.search(r"not found in the agent's variables:\s*([^\"]+)", response.text)
                if m:
                    missing_vars = [v.strip() for v in m.group(1).split(",")]
                    for u in payload["users"]:
                        if "app_variables" in u:
                            for mv in missing_vars:
                                u["app_variables"].pop(mv, None)
                    response = await http_client.post(
                        url,
                        json=payload,
                        headers=headers
                    )
    except httpx.RequestError as req_err:
        logger.error(f"SARVAM AUTO-LEAD REQUEST FAILED: {repr(req_err)}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Sarvam API communication failure: {str(req_err)}"
        )

    if response.is_error:
        logger.error(f"SARVAM AUTO-LEAD ERROR [{response.status_code}]: {response.text}")
        raise HTTPException(
            status_code=response.status_code,
            detail=response.text
        )

    sarvam_result = response.json()

    # Mark lead as queued
    try:
        sb.table("loan_leads").update({
            "call_status": "queued",
            "last_call_at": now.isoformat()
        }).eq("id", lead["id"]).execute()
    except Exception as update_err:
        logger.warning(f"Could not update lead {lead.get('id')} to queued: {update_err}")

    return {
        "success": True,
        "lead_id": lead["id"],
        "full_name": lead.get("full_name"),
        "phone_number": lead["phone_number"],
        "reason": reason,
        "campaign_id": target_campaign_id,
        "sarvam": sarvam_result
    }


async def dispatch_due_followup_leads(
    campaign_id: Optional[str] = None,
    limit: int = 10,
    supabase_client: Optional[Any] = None
) -> Dict[str, Any]:
    """
    Automatic dispatcher that queries and triggers calls for due follow-up leads.
    Only calls when:
      followup_required = true
      AND next_followup_at <= NOW()
      AND retry_count < 3
    """
    sb = supabase_client or get_supabase()
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    try:
        res = (
            sb.table("loan_leads")
            .select("*")
            .eq("followup_required", True)
            .neq("call_status", "queued")
            .lte("next_followup_at", now_iso)
            .order("next_followup_at")
            .limit(limit)
            .execute()
        )
        raw_leads = res.data or []
    except Exception as e:
        logger.error(f"Failed to query due followup leads from database: {e}")
        return {
            "timestamp": now_iso,
            "eligible_count": 0,
            "dispatched_count": 0,
            "dispatched": [],
            "errors": [str(e)]
        }

    # Strict check: retry_count < 3
    eligible_leads = [
        lead for lead in raw_leads
        if (lead.get("retry_count") or 0) < 3
    ]

    dispatched = []
    errors = []

    for lead in eligible_leads:
        try:
            result = await dispatch_lead_call(
                lead=lead,
                campaign_id=campaign_id,
                reason="followup",
                supabase_client=sb
            )
            dispatched.append({
                "lead_id": lead.get("id"),
                "phone_number": lead.get("phone_number"),
                "result": result
            })
        except Exception as e:
            logger.error(f"Failed to dispatch followup call for lead {lead.get('id')}: {e}")
            errors.append({
                "lead_id": lead.get("id"),
                "error": str(e)
            })

    return {
        "timestamp": now_iso,
        "eligible_count": len(eligible_leads),
        "dispatched_count": len(dispatched),
        "dispatched": dispatched,
        "errors": errors
    }


class AutomaticFollowupDispatcher:
    """
    Background worker that runs frequently (every minute by default)
    and dispatches calls to due follow-up leads.
    """
    def __init__(self, interval_seconds: int = DISPATCHER_INTERVAL_SECONDS):
        self.interval_seconds = interval_seconds
        self.is_running = False
        self._task: Optional[asyncio.Task] = None
        self.last_run_at: Optional[str] = None
        self.last_result: Optional[Dict[str, Any]] = None

    async def run_cycle(self, campaign_id: Optional[str] = None) -> Dict[str, Any]:
        result = await dispatch_due_followup_leads(campaign_id=campaign_id)
        self.last_run_at = datetime.now(timezone.utc).isoformat()
        self.last_result = result
        return result

    async def _worker_loop(self):
        logger.info(f"Automatic followup dispatcher started (interval={self.interval_seconds}s)")
        while self.is_running:
            try:
                await self.run_cycle()
            except Exception as e:
                logger.error(f"Error in automatic followup dispatcher loop: {e}")

            try:
                await asyncio.sleep(self.interval_seconds)
            except asyncio.CancelledError:
                break
        logger.info("Automatic followup dispatcher stopped")

    async def start(self):
        if self.is_running:
            return
        self.is_running = True
        self._task = asyncio.create_task(self._worker_loop())

    async def stop(self):
        if not self.is_running:
            return
        self.is_running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None

    def status(self) -> Dict[str, Any]:
        return {
            "running": self.is_running,
            "interval_seconds": self.interval_seconds,
            "last_run_at": self.last_run_at,
            "last_result": self.last_result
        }


followup_dispatcher = AutomaticFollowupDispatcher()
