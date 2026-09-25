import logging
from typing import Any, Dict
from fastapi import APIRouter, HTTPException, status
from backend.core.supabase import supabase
from .sarvam_client import sarvam_client
from .schemas import (
    EmploymentProfileWithApplicationId,
    SarvamDeploymentRequest,
    SarvamOutboundCallRequest,
    SarvamWebhookPayload
)
from .router import save_employment_profile_from_body

logger = logging.getLogger("sarvam_router")

router = APIRouter(
    prefix="/api/sarvam",
    tags=["Sarvam AI"]
)


@router.put("/employment")
@router.post("/employment")
async def sarvam_employment_endpoint(payload: EmploymentProfileWithApplicationId):
    """
    Direct handler for Sarvam AI telephony tool calling /api/sarvam/employment.
    """
    return await save_employment_profile_from_body(payload)


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
