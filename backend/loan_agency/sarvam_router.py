import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
import httpx
from fastapi import APIRouter, HTTPException, status
from backend.core.supabase import supabase
from .sarvam_client import sarvam_client
from .schemas import (
    EmploymentProfileWithApplicationId,
    PersonalLoanProfileWithApplicationId,
    UsedCarLoanProfileWithApplicationId,
    BusinessLoanProfileWithApplicationId,
    SarvamDeploymentRequest,
    SarvamOutboundCallRequest,
    SarvamWebhookPayload
)
from .router import (
    save_employment_profile_from_body,
    save_personal_loan_profile_from_body,
    save_used_car_loan_profile_from_body,
    save_business_loan_profile_from_body,
    get_loan_application,
    get_application_by_mobile,
    get_all_applications_by_mobile
)

logger = logging.getLogger("sarvam_router")

router = APIRouter(
    prefix="/api/sarvam",
    tags=["Sarvam AI"]
)


@router.get("/applications/{application_id}")
async def sarvam_get_application_by_id(application_id: int):
    """
    Direct handler for Sarvam AI telephony tool calling /api/sarvam/applications/{application_id}.
    """
    return await get_loan_application(application_id)


@router.get("/applications/mobile/{mobile_number}")
async def sarvam_get_application_by_mobile(mobile_number: str):
    """
    Direct handler for Sarvam AI telephony tool calling /api/sarvam/applications/mobile/{mobile_number}.
    """
    return await get_application_by_mobile(mobile_number)


@router.get("/applications/mobile/{mobile_number}/all")
async def sarvam_get_all_applications_by_mobile(mobile_number: str):
    """
    Direct handler for Sarvam AI telephony tool calling /api/sarvam/applications/mobile/{mobile_number}/all.
    """
    return await get_all_applications_by_mobile(mobile_number)


@router.put("/employment")
@router.post("/employment")
async def sarvam_employment_endpoint(payload: EmploymentProfileWithApplicationId):
    """
    Direct handler for Sarvam AI telephony tool calling /api/sarvam/employment.
    """
    return await save_employment_profile_from_body(payload)


@router.put("/personal-loans")
@router.post("/personal-loans")
async def sarvam_personal_loans_endpoint(payload: PersonalLoanProfileWithApplicationId):
    """
    Direct handler for Sarvam AI telephony tool calling /api/sarvam/personal-loans.
    """
    return await save_personal_loan_profile_from_body(payload)


@router.put("/used-car-loans")
@router.post("/used-car-loans")
async def sarvam_used_car_loans_endpoint(payload: UsedCarLoanProfileWithApplicationId):
    """
    Direct handler for Sarvam AI telephony tool calling /api/sarvam/used-car-loans.
    """
    return await save_used_car_loan_profile_from_body(payload)


@router.put("/business-loans")
@router.post("/business-loans")
async def sarvam_business_loans_endpoint(payload: BusinessLoanProfileWithApplicationId):
    """
    Direct handler for Sarvam AI telephony tool calling /api/sarvam/business-loans.
    """
    return await save_business_loan_profile_from_body(payload)


@router.post("/deployments/inbound", status_code=status.HTTP_200_OK)
async def create_inbound_deployment(payload: SarvamDeploymentRequest):
    """
    Configure or deploy an inbound Sarvam AI voice telephony agent.
    """
    try:
        data = payload.model_dump(exclude_none=True)
        result = await sarvam_client.deploy_inbound_agent(data)
        return {
            "success": True,
            "data": result
        }
    except Exception as e:
        logger.error(f"DEPLOY INBOUND ERROR: {repr(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to configure inbound deployment: {str(e)}"
        )


@router.post("/outbound", status_code=status.HTTP_200_OK)
async def trigger_outbound_call(payload: SarvamOutboundCallRequest):
    """
    Trigger an outbound telephony call to a lead / applicant via Sarvam AI.
    """
    try:
        result = await sarvam_client.initiate_outbound_call(
            phone_number=payload.phone_number,
            custom_variables=payload.custom_variables,
            lead_id=payload.lead_id,
            application_id=payload.application_id
        )

        # Attempt to log to call_sessions table if available
        sarvam_call_id = result.get("sarvam_call_id")
        try:
            supabase.table("call_sessions").insert({
                "lead_id": payload.lead_id,
                "application_id": payload.application_id,
                "sarvam_call_id": sarvam_call_id,
                "phone_number": payload.phone_number,
                "direction": "outbound",
                "status": result.get("status", "initiated"),
                "metadata": {
                    "customer_name": payload.customer_name,
                    "language": payload.language,
                    "mode": result.get("mode", "live")
                }
            }).execute()
        except Exception as db_err:
            logger.warning(f"Could not write to call_sessions table (migration may not be applied yet): {db_err}")

        return result
    except Exception as e:
        logger.error(f"TRIGGER OUTBOUND ERROR: {repr(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Outbound call initiation failed: {str(e)}"
        )


@router.post("/webhooks/inbound", status_code=status.HTTP_200_OK)
async def handle_inbound_webhook(payload: Dict[str, Any]):
    """
    Receive webhook events from Sarvam for inbound customer voice sessions.
    """
    try:
        event = payload.get("event") or payload.get("status") or "received"
        call_id = payload.get("call_id") or payload.get("sarvam_call_id")

        try:
            supabase.table("sarvam_webhooks").insert({
                "event_type": str(event),
                "direction": "inbound",
                "payload": payload
            }).execute()
        except Exception as db_err:
            logger.warning(f"Could not log inbound webhook to DB: {db_err}")

        return {
            "status": "received",
            "direction": "inbound",
            "event": event,
            "call_id": call_id
        }
    except Exception as e:
        logger.error(f"INBOUND WEBHOOK ERROR: {repr(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/webhooks/outbound", status_code=status.HTTP_200_OK)
async def handle_outbound_webhook(payload: Dict[str, Any]):
    """
    Receive webhook events from Sarvam for outbound campaign call updates.
    """
    try:
        event = payload.get("event") or payload.get("status") or "received"
        call_id = payload.get("call_id") or payload.get("sarvam_call_id")

        # Save webhook payload
        try:
            supabase.table("sarvam_webhooks").insert({
                "event_type": str(event),
                "direction": "outbound",
                "payload": payload
            }).execute()
        except Exception as db_err:
            logger.warning(f"Could not log outbound webhook to DB: {db_err}")

        # If call_sessions exists, update it with status, transcript, recording_url
        if call_id:
            try:
                update_data = {}
                if "status" in payload:
                    update_data["status"] = payload["status"]
                if "duration" in payload:
                    update_data["duration_seconds"] = payload["duration"]
                if "transcript" in payload:
                    update_data["transcript"] = payload["transcript"]
                if "recording_url" in payload:
                    update_data["recording_url"] = payload["recording_url"]

                if update_data:
                    supabase.table("call_sessions").update(update_data).eq("sarvam_call_id", call_id).execute()
            except Exception as update_err:
                logger.warning(f"Could not update call_session: {update_err}")

        return {
            "status": "received",
            "direction": "outbound",
            "event": event,
            "call_id": call_id
        }
    except Exception as e:
        logger.error(f"OUTBOUND WEBHOOK ERROR: {repr(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ============================================================
# SARVAM OUTBOUND CAMPAIGN SCHEDULING (PHASE 2.2 / STEP 1)
# ============================================================

SARVAM_BASE_URL = "https://apps.sarvam.ai/api"
SARVAM_ORG_ID = "019fea16-96c0-705a-88f5-819f95459cc4"
SARVAM_WORKSPACE_ID = "019fea16-96c4-78cd-975e-ee5c73089f99"

SARVAM_APP_ID = "MKN-Financi-3af4be5e-3450"
SARVAM_APP_VERSION = 6

SARVAM_CONNECTION_ID = "1fccc720-e6-bfd93aa8-45de"
SARVAM_OUTBOUND_NUMBER = "+918071582250"
SARVAM_CAMPAIGN_ID = os.getenv("SARVAM_CAMPAIGN_ID", "MKN-Loan-Le-181e5d84-a3cc")



@router.post("/outbound/create-campaign", status_code=status.HTTP_200_OK)
async def create_outbound_campaign():
    """
    Step 1: Create an outbound calling campaign in Sarvam AI for MKN loan leads.
    Configures app_id, connection_id, retry policy, allowed calling windows, and status webhooks.
    """
    api_key = os.getenv("SARVAM_VOICE_AGENT_API_KEY") or os.getenv("SARVAM_API_KEY")

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SARVAM_VOICE_AGENT_API_KEY is not configured"
        )

    now = datetime.now(timezone.utc)

    # Test campaign window (Sarvam requires start_timestamp >= 120s from now)
    start_time = now + timedelta(minutes=5)
    end_time = now + timedelta(days=1)

    url = (
        f"{SARVAM_BASE_URL}/scheduling/v1/"
        f"orgs/{SARVAM_ORG_ID}/"
        f"workspaces/{SARVAM_WORKSPACE_ID}/campaigns"
    )

    payload = {
        "name": "MKN Loan Leads Outbound",
        "description": "Outbound calls for MKN loan leads",

        "app_config": {
            "app_id": SARVAM_APP_ID,
            "app_type": "agent",
            "app_version": SARVAM_APP_VERSION,

            # Start low while testing
            "attempts_per_second": 1,

            "connection_configs": [
                {
                    "connection_id": SARVAM_CONNECTION_ID,
                    "phone_numbers": [
                        SARVAM_OUTBOUND_NUMBER
                    ],
                    "weight": 1
                }
            ],

            "retry_config": {
                "max_retries": 1,
                "retry_interval_minutes": 5,

                "retry_on": {
                    "busy": {
                        "enabled": True
                    },
                    "no_answer": {
                        "enabled": True
                    },
                    "short_duration": {
                        "enabled": True,
                        "threshold_seconds": 30
                    }
                }
            },

            "webhook_config": {
                "metadata": {
                    "source": "mkn_loan_leads"
                },
                "url": (
                    "https://scadova-ai.onrender.com/"
                    "api/loan-agency/sarvam/campaign-webhook"
                )
            }
        },

        "start_timestamp": start_time.isoformat(),
        "end_timestamp": end_time.isoformat(),

        "allowed_schedule": {
            "allowed_start_time": "09:00",
            "allowed_end_time": "20:00",

            "allowed_days": [
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday"
            ],

            "timezone": "Asia/Kolkata"
        }
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
    except httpx.RequestError as req_err:
        logger.error(f"SARVAM CAMPAIGN REQUEST FAILED: {repr(req_err)}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Sarvam API communication failure: {str(req_err)}"
        )

    if response.is_error:
        logger.error(f"SARVAM CAMPAIGN ERROR [{response.status_code}]: {response.text}")
        raise HTTPException(
            status_code=response.status_code,
            detail=response.text
        )

    return response.json()


@router.post("/campaign-webhook", status_code=status.HTTP_200_OK)
@router.post("/sarvam/campaign-webhook", status_code=status.HTTP_200_OK)
async def handle_campaign_webhook(payload: Dict[str, Any]):
    """
    Webhook handler for Sarvam outbound campaign call updates.
    Updates call_status, last_call_status, last_call_end_reason, last_call_at,
    retry_required, retry_count, next_retry_at, call_success in loan_leads.
    """
    try:
        call_id = payload.get("call_id") or payload.get("sarvam_call_id")
        phone_number = (
            payload.get("phone_number")
            or payload.get("target_number")
            or payload.get("user_phone_number")
            or (payload.get("user") or {}).get("user_phone_number")
            or (payload.get("data") or {}).get("phone_number")
        )

        connectivity_status = (
            payload.get("connectivity_status")
            or payload.get("call_status")
            or payload.get("status")
            or payload.get("event")
        )
        completion_status = payload.get("completion_status")
        retry_attempt = payload.get("retry_attempt", 0)
        end_reason = (
            payload.get("end_reason")
            or payload.get("disconnect_reason")
            or payload.get("last_call_end_reason")
        )

        # Log payload to sarvam_webhooks
        try:
            supabase.table("sarvam_webhooks").insert({
                "event_type": str(connectivity_status or completion_status or "campaign_event"),
                "direction": "outbound_campaign",
                "payload": payload
            }).execute()
        except Exception as db_err:
            logger.warning(f"Could not log campaign webhook to DB: {db_err}")

        # Update call_sessions if call_id exists
        if call_id:
            try:
                update_session = {}
                if connectivity_status:
                    update_session["status"] = connectivity_status
                if "duration" in payload:
                    update_session["duration_seconds"] = payload["duration"]
                if "transcript" in payload:
                    update_session["transcript"] = payload["transcript"]
                if "recording_url" in payload:
                    update_session["recording_url"] = payload["recording_url"]
                if update_session:
                    supabase.table("call_sessions").update(update_session).eq("sarvam_call_id", call_id).execute()
            except Exception as update_err:
                logger.warning(f"Could not update call_session: {update_err}")

        updated_lead = None
        normalized = None
        update_data = {}

        if phone_number:
            normalized = (
                str(phone_number)
                .strip()
                .replace(" ", "")
                .replace("-", "")
            )
            if normalized.startswith("91") and not normalized.startswith("+91"):
                normalized = f"+{normalized}"
            elif len(normalized) == 10 and normalized.isdigit():
                normalized = f"+91{normalized}"

            update_data = {
                "last_call_at": datetime.now(timezone.utc).isoformat(),
                "last_call_status": connectivity_status,
                "retry_count": retry_attempt,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            if end_reason:
                update_data["last_call_end_reason"] = end_reason

            # Connected successfully
            if connectivity_status in ["connected", "answered", "call_completed", "completed"]:
                update_data["call_status"] = "answered"
            # No answer
            elif connectivity_status in ["no_answer", "unanswered"]:
                update_data["call_status"] = "no_answer"
                update_data["retry_required"] = True
                update_data["next_retry_at"] = (
                    datetime.now(timezone.utc) + timedelta(minutes=5)
                ).isoformat()
            # Busy
            elif connectivity_status == "busy":
                update_data["call_status"] = "busy"
                update_data["retry_required"] = True
                update_data["next_retry_at"] = (
                    datetime.now(timezone.utc) + timedelta(minutes=5)
                ).isoformat()
            # Failed / network issue
            elif connectivity_status in ["failed", "network_error"]:
                update_data["call_status"] = "failed"
                update_data["retry_required"] = True
                update_data["next_retry_at"] = (
                    datetime.now(timezone.utc) + timedelta(minutes=5)
                ).isoformat()

            # Completion result
            if completion_status == "completed":
                update_data["call_success"] = True
                update_data["retry_required"] = False
                update_data["next_retry_at"] = None
            elif completion_status in ["partial", "failed"]:
                update_data["call_success"] = False

            try:
                res = (
                    supabase.table("loan_leads")
                    .update(update_data)
                    .eq("phone_number", normalized)
                    .execute()
                )
                if res.data and len(res.data) > 0:
                    updated_lead = res.data[0]
            except Exception as lead_err:
                logger.warning(f"Could not update lead from campaign webhook: {lead_err}")

        return {
            "success": True,
            "message": "Campaign webhook processed successfully",
            "phone_number": normalized,
            "connectivity_status": connectivity_status,
            "completion_status": completion_status,
            "update_data": update_data,
            "updated_lead": updated_lead
        }
    except Exception as e:
        logger.error(f"CAMPAIGN WEBHOOK ERROR: {repr(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )



@router.post("/outbound/stream-leads", status_code=status.HTTP_200_OK)
@router.post("/outbound/stream-leads/{campaign_id}", status_code=status.HTTP_200_OK)
async def stream_leads_to_campaign(
    campaign_id: Optional[str] = None,
    limit: int = 10,
    phone_number: Optional[str] = None
):
    """
    Take eligible leads from loan_leads and stream them into the specified Sarvam campaign cohort.
    Uses campaign_id path parameter, or defaults to SARVAM_CAMPAIGN_ID env var / code default.
    Doc: POST https://apps.sarvam.ai/api/scheduling/v1/orgs/{org_id}/workspaces/{workspace_id}/campaigns/{campaign_id}/cohorts/stream
    """
    target_campaign_id = campaign_id or os.getenv("SARVAM_CAMPAIGN_ID") or SARVAM_CAMPAIGN_ID
    if not target_campaign_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No campaign_id provided and SARVAM_CAMPAIGN_ID is not configured"
        )

    api_key = os.getenv("SARVAM_VOICE_AGENT_API_KEY") or os.getenv("SARVAM_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SARVAM_VOICE_AGENT_API_KEY is not configured"
        )

    # -------------------------------------------------
    # 1. FETCH ELIGIBLE LEADS
    # -------------------------------------------------
    if phone_number:
        normalized = phone_number.strip().replace(" ", "").replace("-", "")
        if normalized.startswith("91") and not normalized.startswith("+91"):
            normalized = f"+{normalized}"
        elif len(normalized) == 10 and normalized.isdigit():
            normalized = f"+91{normalized}"

        leads_result = (
            supabase.table("loan_leads")
            .select("*")
            .eq("phone_number", normalized)
            .limit(limit)
            .execute()
        )
    else:
        leads_result = (
            supabase.table("loan_leads")
            .select("*")
            .eq("lead_status", "new")
            .eq("call_status", "not_called")
            .order("id")
            .limit(limit)
            .execute()
        )

    leads = leads_result.data or []
    if not leads:
        return {
            "success": True,
            "message": "No eligible leads found",
            "count": 0
        }

    # -------------------------------------------------
    # 2. BUILD SARVAM USERS
    # -------------------------------------------------
    users = []
    for lead in leads:
        phone = lead.get("phone_number")
        if not phone:
            continue

        app_variables = {
            "lead_id": str(lead["id"]),
            "full_name": lead.get("full_name") or "",
            "city": lead.get("city") or "",
            "preferred_language": lead.get("preferred_language") or ""
        }

        user_entry = {
            "user_phone_number": phone,
            "user_identifier": str(lead["id"]),
            "app_variables": app_variables
        }

        # If preferred_language is set, send initial_language_name override
        # If null/empty, intentionally omit so normal greeting can run
        if lead.get("preferred_language"):
            user_entry["app_overrides"] = {
                "initial_language_name": lead["preferred_language"]
            }

        users.append(user_entry)

    if not users:
        return {
            "success": True,
            "message": "No valid phone numbers found for eligible leads",
            "count": 0
        }

    # -------------------------------------------------
    # 3. STREAM COHORT TO SARVAM
    # -------------------------------------------------
    cohort_name = f"cohort_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
    url = (
        f"{SARVAM_BASE_URL}/scheduling/v1/"
        f"orgs/{SARVAM_ORG_ID}/"
        f"workspaces/{SARVAM_WORKSPACE_ID}/"
        f"campaigns/{target_campaign_id}/cohorts/stream"
    )


    headers = {
        "X-API-Key": api_key,
        "Content-Type": "application/json"
    }

    payload = {
        "name": cohort_name[:50],
        "users": users
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
                import re
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
        logger.error(f"SARVAM STREAM COHORT REQUEST FAILED: {repr(req_err)}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Sarvam API communication failure: {str(req_err)}"
        )

    if response.is_error:
        logger.error(f"SARVAM STREAM COHORT ERROR [{response.status_code}]: {response.text}")
        raise HTTPException(
            status_code=response.status_code,
            detail=response.text
        )

    return response.json()


