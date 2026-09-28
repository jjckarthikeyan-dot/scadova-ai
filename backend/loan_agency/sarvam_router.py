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
    SarvamWebhookPayload,
    LoanApplicationCreate
)
from .router import (
    save_employment_profile_from_body,
    save_personal_loan_profile_from_body,
    save_used_car_loan_profile_from_body,
    save_business_loan_profile_from_body,
    get_loan_application,
    get_application_by_mobile,
    get_all_applications_by_mobile,
    create_loan_application
)

from .dispatcher import (
    process_post_call_followup,
    dispatch_lead_call,
    dispatch_due_followup_leads,
    followup_dispatcher,
    MAX_ATTEMPTS,
    TEST_FOLLOWUP_MINUTES,
    DISPATCHER_INTERVAL_SECONDS
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


@router.post("/applications", status_code=status.HTTP_201_CREATED)
async def sarvam_create_loan_application_endpoint(payload: LoanApplicationCreate):
    """
    Direct handler for Sarvam AI telephony tool calling /api/sarvam/applications.
    """
    return await create_loan_application(payload)



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
SARVAM_APP_VERSION = int(os.getenv("SARVAM_APP_VERSION", "8"))


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
            # Check existing lead status and handle post-call follow-up
            lead = None
            try:
                lead_res = (
                    supabase.table("loan_leads")
                    .select("*")
                    .eq("phone_number", normalized)
                    .limit(1)
                    .execute()
                )
                if (
                    lead_res
                    and isinstance(lead_res.data, list)
                    and len(lead_res.data) > 0
                    and isinstance(lead_res.data[0], dict)
                ):
                    lead = lead_res.data[0]
            except Exception as lead_err:
                logger.warning(f"Could not fetch lead by phone {normalized}: {lead_err}")

            # After each call, if the application is still incomplete:
            if lead:
                is_completed = (
                    lead.get("application_completed") is True
                    or lead.get("lead_status") == "application_completed"
                    or payload.get("application_completed") is True
                )
                if not is_completed:
                    followup_update = process_post_call_followup(lead)
                    update_data.update(followup_update)
                elif completion_status == "completed":
                    update_data["lead_status"] = "application_completed"
                    update_data["call_status"] = "completed"
                    update_data["application_completed"] = True
                    update_data["followup_required"] = False
                    update_data["next_followup_at"] = None
                    update_data["lead_success"] = True

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

        # If preferred_language is set, send initial_language_name override
        # If null/empty, intentionally omit so normal greeting can run
        if lead.get("preferred_language"):
            user["app_overrides"] = {
                "initial_language_name": lead["preferred_language"]
            }

        users.append(user)


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

    # -------------------------------------------------
    # 4. MARK ACCEPTED LEADS AS QUEUED (NOT CALLED)
    # -------------------------------------------------
    for lead in leads:
        try:
            supabase.table("loan_leads").update({
                "call_status": "queued"
            }).eq("id", lead["id"]).execute()
        except Exception as update_err:
            logger.warning(f"Could not update lead {lead.get('id')} to queued: {update_err}")

    return response.json()


@router.get("/outbound/cohort-status/{campaign_id}/{cohort_id}", status_code=status.HTTP_200_OK)
@router.get("/outbound/cohort-status/{cohort_id}", status_code=status.HTTP_200_OK)
async def get_cohort_status(cohort_id: str, campaign_id: Optional[str] = None):
    """
    Check the processing status of a streamed cohort in Sarvam.
    Doc: GET https://apps.sarvam.ai/api/scheduling/v1/orgs/{org_id}/workspaces/{workspace_id}/campaigns/{campaign_id}/cohorts/{cohort_id}
    """
    api_key = os.getenv("SARVAM_VOICE_AGENT_API_KEY") or os.getenv("SARVAM_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SARVAM_VOICE_AGENT_API_KEY is not configured"
        )

    target_campaign_id = campaign_id or os.getenv("SARVAM_CAMPAIGN_ID") or SARVAM_CAMPAIGN_ID
    url = (
        f"{SARVAM_BASE_URL}/scheduling/v1/"
        f"orgs/{SARVAM_ORG_ID}/"
        f"workspaces/{SARVAM_WORKSPACE_ID}/"
        f"campaigns/{target_campaign_id}/"
        f"cohorts/{cohort_id}"
    )

    headers = {
        "X-API-Key": api_key
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            response = await http_client.get(url, headers=headers)
    except httpx.RequestError as req_err:
        logger.error(f"SARVAM GET COHORT STATUS FAILED: {repr(req_err)}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Sarvam API communication failure: {str(req_err)}"
        )

    if response.is_error:
        raise HTTPException(
            status_code=response.status_code,
            detail=response.text
        )

    return response.json()


async def run_outbound_dispatch(campaign_id: Optional[str] = None):
    """
    Core outbound dispatch engine that selects the next lead based on priority:
    1. callback: callback_required == True and callback_at <= now
    2. reschedule: reschedule_required == True and reschedule_at <= now
    3. retry: retry_required == True and next_retry_at <= now
    4. followup: followup_required == True and next_followup_at <= now and retry_count < 3
    5. new_lead: lead_status == 'new' and call_status == 'not_called'

    Streams the selected lead to the Sarvam campaign cohort and marks the lead as 'queued'.
    """
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

    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    lead = None
    selected_reason = None

    # 1. CALLBACK CHECK
    cb_res = (
        supabase.table("loan_leads")
        .select("*")
        .eq("callback_required", True)
        .neq("call_status", "queued")
        .lte("callback_at", now_iso)
        .order("callback_at")
        .limit(1)
        .execute()
    )
    if cb_res.data:
        lead = cb_res.data[0]
        selected_reason = "callback"

    # 2. RESCHEDULE CHECK
    if not lead:
        rs_res = (
            supabase.table("loan_leads")
            .select("*")
            .eq("reschedule_required", True)
            .neq("call_status", "queued")
            .lte("reschedule_at", now_iso)
            .order("reschedule_at")
            .limit(1)
            .execute()
        )
        if rs_res.data:
            lead = rs_res.data[0]
            selected_reason = "reschedule"

    # 3. RETRY CHECK
    if not lead:
        rt_res = (
            supabase.table("loan_leads")
            .select("*")
            .eq("retry_required", True)
            .neq("call_status", "queued")
            .lte("next_retry_at", now_iso)
            .order("next_retry_at")
            .limit(1)
            .execute()
        )
        if rt_res.data:
            lead = rt_res.data[0]
            selected_reason = "retry"

    # 4. FOLLOW-UP CHECK
    if not lead:
        fu_res = (
            supabase.table("loan_leads")
            .select("*")
            .eq("followup_required", True)
            .neq("call_status", "queued")
            .lte("next_followup_at", now_iso)
            .order("next_followup_at")
            .limit(10)
            .execute()
        )
        if fu_res.data:
            for item in fu_res.data:
                if (item.get("retry_count") or 0) < 3:
                    lead = item
                    selected_reason = "followup"
                    break

    # 5. NEW LEAD CHECK
    if not lead:
        nl_res = (
            supabase.table("loan_leads")
            .select("*")
            .eq("lead_status", "new")
            .eq("call_status", "not_called")
            .order("id")
            .limit(1)
            .execute()
        )
        if nl_res.data:
            lead = nl_res.data[0]
            selected_reason = "new_lead"

    # 6. NO LEADS FOUND
    if not lead:
        return {
            "success": True,
            "message": "No eligible leads due for calling",
            "lead_id": None,
            "reason": None
        }

    phone = lead.get("phone_number")
    if not phone:
        return {
            "success": False,
            "message": f"Lead {lead.get('id')} has no valid phone number",
            "lead_id": lead.get("id"),
            "reason": selected_reason
        }

    # --------------------------------------------
    # 7. BUILD SARVAM USER
    # --------------------------------------------
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

    # --------------------------------------------
    # 8. STREAM COHORT TO SARVAM
    # --------------------------------------------
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

    # --------------------------------------------
    # 10. MARK AS QUEUED
    # --------------------------------------------
    (
        supabase.table("loan_leads")
        .update({
            "call_status": "queued",
            "last_call_at": now.isoformat()
        })
        .eq("id", lead["id"])
        .execute()
    )

    return {
        "success": True,
        "lead_id": lead["id"],
        "full_name": lead.get("full_name"),
        "phone_number": lead["phone_number"],
        "reason": selected_reason,
        "campaign_id": target_campaign_id,
        "sarvam": sarvam_result
    }


@router.post("/outbound/auto-dispatch", status_code=status.HTTP_200_OK)
@router.post("/outbound/auto-dispatch/{campaign_id}", status_code=status.HTTP_200_OK)
@router.post("/api/loan-agency/outbound/auto-dispatch", status_code=status.HTTP_200_OK)
@router.post("/api/loan-agency/outbound/auto-dispatch/{campaign_id}", status_code=status.HTTP_200_OK)
@router.post("/outbound/trigger-next-lead", status_code=status.HTTP_200_OK)
@router.post("/outbound/trigger-next-lead/{campaign_id}", status_code=status.HTTP_200_OK)
async def auto_dispatch_outbound(campaign_id: Optional[str] = None):
    """
    Auto-dialer endpoint that triggers the highest priority eligible lead.
    """
    return await run_outbound_dispatch(campaign_id=campaign_id)


# Backward-compatible alias
trigger_next_lead = auto_dispatch_outbound


async def outbound_scheduler():
    """
    Background scheduler loop that runs inside FastAPI.
    Checks loan_leads every 60 seconds and automatically dispatches eligible leads to Sarvam.
    """
    while True:
        try:
            print("OUTBOUND SCHEDULER: checking loan_leads...")
            result = await run_outbound_dispatch()
            print("OUTBOUND SCHEDULER RESULT:", result)
        except Exception as exc:
            print("OUTBOUND SCHEDULER ERROR:", str(exc))
        await asyncio.sleep(60)



# ============================================================
# POST-CALL PROCESSING & AUTOMATIC DISPATCHER ENDPOINTS
# ============================================================

@router.post("/outbound/post-call-process", status_code=status.HTTP_200_OK)
@router.post("/sarvam/outbound/post-call-process", status_code=status.HTTP_200_OK)
async def post_call_process_endpoint(payload: Dict[str, Any]):
    """
    Evaluates follow-up status after a call session and records attempt.
    """
    lead_id = payload.get("lead_id")
    phone_number = payload.get("phone_number")
    lead = payload.get("lead")

    if not lead:
        query = supabase.table("loan_leads").select("*")
        if lead_id:
            res = query.eq("id", lead_id).limit(1).execute()
        elif phone_number:
            res = query.eq("phone_number", phone_number).limit(1).execute()
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either lead_id, phone_number, or lead object is required"
            )
        if not res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lead not found"
            )
        lead = res.data[0]

    is_completed = (
        lead.get("application_completed") is True
        or lead.get("lead_status") == "application_completed"
        or payload.get("application_completed") is True
    )

    if is_completed:
        update_data = {
            "lead_status": "application_completed",
            "call_status": "completed",
            "application_completed": True,
            "followup_required": False,
            "next_followup_at": None,
            "lead_success": True
        }
    else:
        update_data = process_post_call_followup(lead)

    update_res = supabase.table("loan_leads").update(update_data).eq("id", lead["id"]).execute()
    updated_lead = update_res.data[0] if update_res.data else lead

    return {
        "success": True,
        "lead_id": lead["id"],
        "is_application_completed": is_completed,
        "update_data": update_data,
        "lead": updated_lead
    }


@router.get("/outbound/dispatcher/status", status_code=status.HTTP_200_OK)
@router.get("/sarvam/outbound/dispatcher/status", status_code=status.HTTP_200_OK)
async def get_dispatcher_status():
    """
    Returns the current running status and telemetry of the automatic dispatcher.
    """
    return followup_dispatcher.status()


@router.post("/outbound/dispatcher/run-once", status_code=status.HTTP_200_OK)
@router.post("/sarvam/outbound/dispatcher/run-once", status_code=status.HTTP_200_OK)
async def run_dispatcher_once(campaign_id: Optional[str] = None):
    """
    Triggers an immediate single execution cycle of the automatic dispatcher.
    Dispatches calls only if:
      followup_required = true
      AND next_followup_at <= NOW()
      AND retry_count < 3
    """
    return await followup_dispatcher.run_cycle(campaign_id=campaign_id)


@router.post("/outbound/dispatcher/start", status_code=status.HTTP_200_OK)
@router.post("/sarvam/outbound/dispatcher/start", status_code=status.HTTP_200_OK)
async def start_dispatcher():
    """
    Starts the automatic dispatcher background loop.
    """
    await followup_dispatcher.start()
    return {
        "success": True,
        "message": "Automatic followup dispatcher started",
        "status": followup_dispatcher.status()
    }


@router.post("/outbound/dispatcher/stop", status_code=status.HTTP_200_OK)
@router.post("/sarvam/outbound/dispatcher/stop", status_code=status.HTTP_200_OK)
async def stop_dispatcher():
    """
    Stops the automatic dispatcher background loop.
    """
    await followup_dispatcher.stop()
    return {
        "success": True,
        "message": "Automatic followup dispatcher stopped",
        "status": followup_dispatcher.status()
    }





