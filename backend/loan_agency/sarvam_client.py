import os
import uuid
import logging
from typing import Any, Dict, Optional
import httpx

logger = logging.getLogger("sarvam_client")


class SarvamClient:
    """
    Async HTTP client for Sarvam AI Voice & Telephony APIs.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: float = 30.0
    ):
        self.api_key = api_key or os.getenv("SARVAM_API_KEY", "")
        self.base_url = (base_url or os.getenv("SARVAM_BASE_URL", "https://api.sarvam.ai")).rstrip("/")
        self.timeout = timeout

        if not self.api_key:
            logger.warning(
                "SARVAM_API_KEY is not configured in environment. Sarvam calls will operate in simulation/mock mode."
            )

    def _get_headers(self) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        if self.api_key:
            headers["api-subscription-key"] = self.api_key
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    async def deploy_inbound_agent(self, deployment_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Deploy or configure an inbound conversational telephony agent on Sarvam AI.
        """
        if not self.api_key:
            mock_id = f"dep_mock_{uuid.uuid4().hex[:10]}"
            return {
                "success": True,
                "deployment_id": mock_id,
                "mode": "simulation",
                "message": "Sarvam inbound agent configured (simulated mode, set SARVAM_API_KEY for live)",
                "config": deployment_data
            }

        endpoint = f"{self.base_url}/telephony/deployments"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                endpoint,
                headers=self._get_headers(),
                json=deployment_data
            )
            response.raise_for_status()
            return response.json()

    async def initiate_outbound_call(
        self,
        phone_number: str,
        custom_variables: Optional[Dict[str, Any]] = None,
        lead_id: Optional[str] = None,
        application_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Initiate an outbound telephony call via Sarvam AI.
        """
        if not self.api_key:
            simulated_call_id = f"call_sarvam_{uuid.uuid4().hex[:12]}"
            return {
                "success": True,
                "sarvam_call_id": simulated_call_id,
                "phone_number": phone_number,
                "status": "queued",
                "mode": "simulation",
                "lead_id": lead_id,
                "application_id": application_id,
                "message": "Outbound call queued successfully (simulated mode, set SARVAM_API_KEY for live)"
            }

        endpoint = f"{self.base_url}/telephony/outbound-call"
        payload = {
            "phone_number": phone_number,
            "custom_variables": custom_variables or {}
        }
        if lead_id:
            payload["lead_id"] = lead_id

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                endpoint,
                headers=self._get_headers(),
                json=payload
            )
            response.raise_for_status()
            data = response.json()
            return {
                "success": True,
                "sarvam_call_id": data.get("call_id") or data.get("sarvam_call_id") or f"call_{uuid.uuid4().hex[:8]}",
                "phone_number": phone_number,
                "status": data.get("status", "initiated"),
                "raw_response": data
            }

    async def get_call_details(self, call_id: str) -> Dict[str, Any]:
        """
        Retrieve call status, duration, and transcripts for a given Sarvam call ID.
        """
        if not self.api_key:
            return {
                "sarvam_call_id": call_id,
                "status": "completed",
                "duration": 95,
                "mode": "simulation",
                "transcript": "Simulated conversation completed.",
                "recording_url": None
            }

        endpoint = f"{self.base_url}/telephony/calls/{call_id}"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(
                endpoint,
                headers=self._get_headers()
            )
            response.raise_for_status()
            return response.json()


# Singleton instance
sarvam_client = SarvamClient()
