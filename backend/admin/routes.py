"""
Admin Portal API Router for Scadova AI Phase 2.
Control center for Businesses, Voice Agents, Calls, Appointments, Leads,
Usage & Cost, Integrations, Prompt Versions, API Explorer Telemetry, and System Logs.
"""
import time
import logging
import uuid
from typing import Dict, List, Optional, Any
from fastapi import APIRouter, HTTPException, status, Request
from pydantic import BaseModel, Field

from backend.admin.store import data_store, _now_iso
from backend.core.prompt_builder import get_router_tools_for_business_type
from backend.admin.industry_prompts import (
    get_industry_template,
    render_prompt,
    render_greeting,
    list_industry_templates,
    update_industry_template,
)

logger = logging.getLogger("admin_routes")

router = APIRouter(
    prefix="/admin",
    tags=["Admin Dashboard & Control Center"]
)


# ============================================================
# PYDANTIC SCHEMAS FOR ADMIN PORTAL
# ============================================================

class BusinessCreatePayload(BaseModel):
    name: str = Field(..., description="Business Name")
    type: str = Field(default="service_and_appointment", description="Business Type")
    industry: Optional[str] = "Service & Consultation"
    country: Optional[str] = "United States"
    timezone: Optional[str] = "America/New_York"
    phone: Optional[str] = ""
    email: Optional[str] = ""
    website: Optional[str] = ""
    address: Optional[str] = ""
    description: Optional[str] = ""
    logo_url: Optional[str] = ""
    agent_name: Optional[str] = None
    voice_id: Optional[str] = None
    voice_name: Optional[str] = None
    language: Optional[str] = "en"
    hours_data: Optional[List[Dict[str, Any]]] = None
    services_data: Optional[List[Dict[str, Any]]] = None
    system_prompt: Optional[str] = None
    first_message: Optional[str] = None
    attached_tools: Optional[List[str]] = None
    auto_create_agent: bool = True


class BusinessUpdatePayload(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    business_type: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None
    timezone: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    hours_data: Optional[List[Dict[str, Any]]] = None
    services_data: Optional[List[Dict[str, Any]]] = None
    agent_name: Optional[str] = None
    fish_agent_id: Optional[str] = None
    agent_id: Optional[str] = None
    voice: Optional[str] = None
    voice_id: Optional[str] = None
    language: Optional[str] = None
    llm: Optional[str] = None
    prompt_version: Optional[str] = None
    first_message: Optional[str] = None
    system_prompt: Optional[str] = None
    attached_tools: Optional[List[str]] = None


class AgentCreatePayload(BaseModel):
    business_id: int
    name: str
    role: Optional[str] = "Appointment Specialist"
    voice_id: Optional[str] = "scadova_voice_default"
    voice_name: Optional[str] = "Default Voice"
    language: Optional[str] = "en"
    accent: Optional[str] = "Standard"
    llm_provider: Optional[str] = "Scadova Runtime"
    llm_model: Optional[str] = "scadova-routing-v1"
    first_message: Optional[str] = "Hello! How can I assist you today?"
    attached_tools: Optional[List[str]] = []


class AgentTestPayload(BaseModel):
    message: str


class OnboardingDraftPayload(BaseModel):
    session_id: str
    current_step: int = 1
    business_data: Dict[str, Any] = {}
    hours_data: List[Dict[str, Any]] = []
    services_data: List[Dict[str, Any]] = []
    agent_data: Dict[str, Any] = {}
    voice_data: Dict[str, Any] = {}
    llm_data: Dict[str, Any] = {}
    features_data: List[str] = []
    rules_data: Dict[str, Any] = {}


class OnboardingCompletePayload(BaseModel):
    business_data: Dict[str, Any]
    hours_data: List[Dict[str, Any]] = []
    services_data: List[Dict[str, Any]] = []
    agent_data: Dict[str, Any]
    voice_data: Dict[str, Any]
    llm_data: Dict[str, Any]
    features_data: List[str] = []
    rules_data: Dict[str, Any] = {}


class IntegrationConfigurePayload(BaseModel):
    config: Dict[str, Any]


class CallLogPayload(BaseModel):
    business_id: int
    agent_id: str
    caller: str
    called_number: str
    direction: str = "inbound"
    duration_seconds: int = Field(default=0, ge=0)
    latency_ms: Optional[float] = Field(default=None, ge=0, allow_inf_nan=False)
    transcript: Optional[str] = ""
    summary: Optional[str] = ""
    outcome: Optional[str] = "COMPLETED"
    appointment_ref: Optional[str] = None
    lead_ref: Optional[str] = None
    voice_cost: float = 0
    llm_cost: float = 0
    telephony_cost: float = 0
    analysis: Optional[Dict[str, Any]] = None


class AgentCreditLimitPayload(BaseModel):
    credit_limit: float = Field(..., ge=0, allow_inf_nan=False, description="Maximum credits this agent may hold or consume")
    credits_per_minute: Optional[float] = Field(default=None, ge=0, allow_inf_nan=False, description="Credits deducted per billable minute")
    low_balance_threshold: Optional[float] = Field(default=None, ge=0, allow_inf_nan=False, description="Low balance warning threshold")


class AgentCreditTopUpPayload(BaseModel):
    amount: float = Field(..., gt=0, allow_inf_nan=False, description="Credits to add to the agent balance")
    note: Optional[str] = "Manual admin top-up"


# ============================================================
# 1. DASHBOARD OVERVIEW & STATS
# ============================================================

@router.get("/stats")
async def get_dashboard_stats():
    """Aggregated KPIs for Dashboard Overview."""
    businesses = data_store.list_businesses()
    agents = data_store.list_agents()
    calls = data_store.list_calls()
    appointments = data_store.list_appointments()
    leads = data_store.list_leads()

    total_cost = sum([float(b.get("cost", 0.0)) for b in businesses])

    # Count by business type
    type_counts = {
        "Service and Appointment Booking": 0,
        "Restaurant": 0,
        "Loan Agency": 0,
        "Custom": 0,
    }
    for b in businesses:
        b_type = (b.get("type") or b.get("business_type") or "").lower()
        if "service" in b_type or "appointment" in b_type:
            type_counts["Service and Appointment Booking"] += 1
        elif "restaurant" in b_type:
            type_counts["Restaurant"] += 1
        elif "loan" in b_type or "finance" in b_type:
            type_counts["Loan Agency"] += 1
        else:
            type_counts["Custom"] += 1

    return {
        "success": True,
        "businesses": len(businesses),
        "agents": len(agents),
        "calls": len(calls),
        "appointments": len(appointments),
        "leads": len(leads),
        "cost": f"{total_cost:.2f}",
        "business_type_counts": type_counts,
        "system_status": "Healthy",
        "agent_runtime_status": "Local tracking enabled"
    }


# ============================================================
# 2. BUSINESSES ENDPOINTS (PHASE 2A)
# ============================================================

@router.get("/businesses")
async def list_businesses():
    """List all registered businesses (includes Bawarchi Restaurant & MKN Finance India)."""
    return data_store.list_businesses()


@router.post("/businesses", status_code=status.HTTP_201_CREATED)
async def create_business(payload: BusinessCreatePayload):
    """Register a new business and auto-provision its Voice Agent with industry prompt ready for Fish Audio."""
    data = payload.model_dump()
    biz = data_store.add_business(data)
    biz_id = biz.get("id")

    # Persist services to Supabase if configured
    if payload.services_data and biz_id:
        try:
            from backend.core.supabase import supabase
            for s in payload.services_data:
                s_name = (s.get("service_name") or s.get("name") or "").strip()
                if s_name:
                    s_price = s.get("price")
                    s_dur = s.get("duration_minutes")
                    s_desc = (s.get("description") or s.get("short_description") or "").strip()
                    supabase.table("services").insert({
                        "business_id": biz_id,
                        "service_name": s_name,
                        "short_description": s_desc,
                        "detailed_description": s_desc,
                        "price": float(s_price) if s_price is not None and str(s_price).strip() != "" else None,
                        "duration_minutes": int(s_dur) if s_dur is not None and str(s_dur).strip() != "" else None,
                        "active": True
                    }).execute()
        except Exception as e:
            logger.debug(f"Catalogue services table sync: {e}")

    # Persist operating hours to Supabase if configured
    if payload.hours_data and biz_id:
        try:
            from backend.core.supabase import supabase
            for h in payload.hours_data:
                supabase.table("business_hours").insert({
                    "business_id": biz_id,
                    "day": (h.get("day") or "").lower(),
                    "open_time": None if h.get("closed") else h.get("open_time"),
                    "close_time": None if h.get("closed") else h.get("close_time"),
                    "closed": bool(h.get("closed"))
                }).execute()
        except Exception as e:
            logger.debug(f"Business hours table sync: {e}")

    if payload.auto_create_agent:
        biz_id = biz.get("id")
        b_key = biz.get("business_key") or f"biz_{biz_id}"
        biz_name = biz.get("name", "Business")
        
        # Resolve industry template
        industry_input = payload.industry or payload.type
        template = get_industry_template(industry_input)
        
        agent_name = (payload.agent_name or f"{biz_name} AI Specialist").strip()
        role = template.get("default_agent_role") or template.get("role") or "Appointment & Consultation Specialist"
        voice_id = payload.voice_id or template.get("default_voice_id", "serena_exec_en")
        voice_name = payload.voice_name or template.get("default_voice_name", "Serena - Executive English")
        language = payload.language or template.get("default_language", "en")
        tools = payload.attached_tools if (payload.attached_tools is not None and len(payload.attached_tools) > 0) else template.get("tools", [])
        
        # Render system prompt and greeting (or use customized ones provided in the payload)
        system_prompt = (
            payload.system_prompt.strip()
            if payload.system_prompt and payload.system_prompt.strip()
            else render_prompt(
                template["system_prompt"],
                business_name=biz_name,
                agent_name=agent_name,
                business_key=b_key,
            )
        )
        first_message = (
            payload.first_message.strip()
            if payload.first_message and payload.first_message.strip()
            else render_greeting(
                template["greeting"],
                business_name=biz_name,
                agent_name=agent_name,
            )
        )
        
        # Save prompt version to store & Supabase
        prompt_rec = data_store.add_prompt_version({
            "business_id": biz_id,
            "version_number": 1,
            "version_label": "v1.0",
            "prompt_text": system_prompt,
            "changed_fields": {"auto_generated": True, "industry": template["key"]},
            "is_published": True,
            "created_by": "System Auto-Provisioner",
        })
        
        # Dedicated runtime agent ID formatted for Fish Audio
        clean_key = b_key.lower().replace("-", "_")
        fish_agent_id = f"agent_{clean_key[:22]}"
        
        agent_record = {
            "business_id": biz_id,
            "business_name": biz_name,
            "business_type": biz.get("type", "service_and_appointment"),
            "name": agent_name,
            "role": role,
            "fish_agent_id": fish_agent_id,
            "agent_id": fish_agent_id,
            "voice_id": voice_id,
            "voice_name": voice_name,
            "language": language,
            "llm_provider": "Scadova Runtime",
            "llm_model": "scadova-routing-v1",
            "first_message": first_message,
            "system_prompt": system_prompt,
            "prompt_version_id": prompt_rec.get("id"),
            "prompt_version": "v1.0",
            "attached_tools": tools,
            "status": "active",
        }
        saved_agent = data_store.add_agent(agent_record)
        
        # Update business with mapped agent details
        updates = {
            "agent_id": fish_agent_id,
            "fish_agent_id": fish_agent_id,
            "agent_name": agent_name,
            "voice": voice_name,
            "voice_id": voice_id,
            "language": language,
            "prompt_version": "v1.0",
            "first_message": first_message,
            "system_prompt": system_prompt,
            "status": "active",
        }
        data_store.update_business(biz_id, updates)
        biz.update(updates)
        
        # Initialize default Fish Audio credit tracking & knowledge base
        data_store._default_credit_settings(saved_agent)
        data_store.set_provider_knowledge(fish_agent_id, {
            "agent_id": fish_agent_id,
            "business_name": biz_name,
            "profile": {
                "description": biz.get("description") or f"Enterprise Voice Agent for {biz_name}",
                "hours": "Configured operating hours",
                "policies": "Appointments require verified customer details and backend tool execution.",
            },
            "extra_markdown": f"# Live System Prompt for {biz_name}\n\n{system_prompt}",
        })
        
        biz["agent"] = saved_agent
        biz["prompt_version"] = prompt_rec
        
    return biz


@router.get("/industry-templates")
async def get_industry_templates():
    """List all pre-defined industry templates with system prompts and greetings."""
    return {"success": True, "templates": list_industry_templates()}


@router.put("/industry-templates/{industry_key}")
async def update_industry_template_endpoint(industry_key: str, payload: Dict[str, Any]):
    """Update system prompt or greeting template for an industry."""
    updated = update_industry_template(
        industry_key,
        system_prompt=payload.get("system_prompt"),
        greeting=payload.get("greeting"),
    )
    if not updated:
        raise HTTPException(404, "Industry template not found")
    return {"success": True, "template": updated}


@router.get("/businesses/{business_id}")
async def get_business(business_id: str):
    """Get single business details including services and operating hours."""
    biz = data_store.get_business(business_id)
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    
    biz_id = biz.get("id")
    if biz_id:
        try:
            from backend.core.supabase import supabase
            s_res = supabase.table("services").select("*").eq("business_id", biz_id).execute()
            biz["services"] = s_res.data or []
        except Exception as e:
            logger.debug(f"Fetch services note: {e}")
            biz["services"] = []

        try:
            from backend.core.supabase import supabase
            h_res = supabase.table("business_hours").select("*").eq("business_id", biz_id).execute()
            biz["hours"] = h_res.data or []
        except Exception as e:
            logger.debug(f"Fetch hours note: {e}")
            biz["hours"] = []

    return biz


@router.put("/businesses/{business_id}")
async def update_business(business_id: str, payload: BusinessUpdatePayload):
    """Update business details."""
    updated = data_store.update_business(business_id, payload.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Business not found")

    biz_id = updated.get("id")
    if biz_id:
        from backend.core.supabase import supabase
        # Sync services if provided
        if payload.services_data is not None:
            try:
                supabase.table("services").delete().eq("business_id", biz_id).execute()
                for s in payload.services_data:
                    s_name = (s.get("service_name") or s.get("name") or "").strip()
                    if not s_name:
                        continue
                    s_price = s.get("price")
                    s_dur = s.get("duration_minutes") or s.get("duration")
                    s_desc = s.get("short_description") or s.get("description") or ""
                    supabase.table("services").insert({
                        "business_id": biz_id,
                        "service_name": s_name,
                        "short_description": s_desc,
                        "detailed_description": s_desc,
                        "price": float(s_price) if s_price is not None and str(s_price).strip() != "" else None,
                        "duration_minutes": int(s_dur) if s_dur is not None and str(s_dur).strip() != "" else None,
                        "active": True
                    }).execute()
            except Exception as e:
                logger.debug(f"Update services sync note: {e}")

        # Sync hours if provided
        if payload.hours_data is not None:
            try:
                supabase.table("business_hours").delete().eq("business_id", biz_id).execute()
                for h in payload.hours_data:
                    supabase.table("business_hours").insert({
                        "business_id": biz_id,
                        "day": (h.get("day") or "").lower(),
                        "open_time": None if h.get("closed") else h.get("open_time"),
                        "close_time": None if h.get("closed") else h.get("close_time"),
                        "closed": bool(h.get("closed"))
                    }).execute()
            except Exception as e:
                logger.debug(f"Update hours sync note: {e}")

    return updated


@router.delete("/businesses/{business_id}")
async def delete_business(business_id: str):
    """Delete a business and all associated child data."""
    success = data_store.delete_business(business_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete business and related records")
    return {"success": True, "message": "Business and related data permanently deleted"}


# ============================================================
# 3. ONBOARDING & LOCAL AGENT SETUP (PHASE 2B)
# ============================================================

@router.get("/onboarding/voices")
async def get_available_voices(language: Optional[str] = None):
    """Return local voice profile options for agent setup."""
    voices = [
        {
            "voice_id": "scadova_voice_en_neutral",
            "voice_name": "Scadova Neutral English",
            "language": "en",
            "languages": ["en"],
            "locale": "en-US",
            "gender": "Female",
            "accent": "American - Neutral Professional",
            "description": "Default English voice profile for service and appointment workflows.",
            "preview_url": "",
        },
        {
            "voice_id": "scadova_voice_en_warm",
            "voice_name": "Scadova Warm Host",
            "language": "en",
            "languages": ["en"],
            "locale": "en-US",
            "gender": "Female",
            "accent": "American - Warm Conversational",
            "description": "Warm hospitality voice profile for restaurants and customer service.",
            "preview_url": "",
        },
        {
            "voice_id": "scadova_voice_te_conversational",
            "voice_name": "Scadova Telugu Specialist",
            "language": "te",
            "languages": ["te"],
            "locale": "te-IN",
            "gender": "Male",
            "accent": "Standard Telugu - Conversational",
            "description": "Telugu voice profile for finance, support, and callback workflows.",
            "preview_url": "",
        },
    ]
    if language:
        voices = [v for v in voices if v["language"] == language]
    return {
        "success": True,
        "count": len(voices),
        "language_filter": language or "all",
        "voices": voices
    }


@router.get("/onboarding/llms")
async def get_supported_llms():
    """Return supported local agent runtime models."""
    llms = [
        {
            "provider": "Scadova Runtime",
            "model": "scadova-routing-v1",
            "name": "Scadova Routing Runtime",
            "description": "Default business-router runtime with preinstalled tools and call tracking.",
            "is_default": True,
        },
        {
            "provider": "OpenAI",
            "model": "gpt-4o-mini",
            "name": "OpenAI GPT-4o Mini",
            "description": "Optional reasoning model for richer conversations and summaries.",
            "is_default": False,
        },
    ]
    return {
        "success": True,
        "llms": llms
    }


@router.get("/onboarding/draft/{session_id}")
async def get_onboarding_draft(session_id: str):
    """Retrieve saved onboarding wizard draft."""
    draft = data_store.get_draft(session_id)
    if not draft:
        return {"found": False, "data": None}
    return {"found": True, "draft": draft}


@router.post("/onboarding/draft")
async def save_onboarding_draft(payload: OnboardingDraftPayload):
    """Save an in-progress onboarding draft."""
    saved = data_store.save_draft(payload.session_id, payload.model_dump())
    return {"success": True, "draft": saved}


@router.post("/onboarding/create-agent", status_code=status.HTTP_201_CREATED)
async def complete_onboarding_and_create_agent(payload: OnboardingCompletePayload):
    """
    Complete onboarding, attach business router tools, persist local agent records,
    and initialize tracking without an external voice-provider setup.
    """
    biz_data = payload.business_data
    agent_data = payload.agent_data
    voice_data = payload.voice_data
    llm_data = payload.llm_data
    hours_data = payload.hours_data
    services_data = payload.services_data
    features_data = payload.features_data

    # Required configuration is validated on the server as well as in the wizard.
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
    try:
        ZoneInfo(biz_data.get("timezone", ""))
    except (ZoneInfoNotFoundError, ValueError):
        raise HTTPException(422, "Enter a valid IANA timezone.")
    if not all(str(agent_data.get(k, "")).strip() for k in ("name", "role", "first_message")):
        raise HTTPException(422, "Agent name, role and greeting are required.")
    if not voice_data.get("voice_id") or not llm_data.get("model"):
        raise HTTPException(422, "Select a voice and runtime model.")
    if not payload.rules_data.get("rules_accepted"):
        raise HTTPException(422, "Review and accept the conversation rules.")
    if not hours_data and not payload.rules_data.get("hours_unavailable"):
        raise HTTPException(422, "Provide hours or mark them unavailable.")
    for hour in hours_data:
        if not hour.get("closed") and (not hour.get("open_time") or not hour.get("close_time") or hour["open_time"] >= hour["close_time"]):
            raise HTTPException(422, "Opening time must precede closing time.")
    if not services_data and not payload.rules_data.get("catalogue_unavailable"):
        raise HTTPException(422, "Provide a catalogue or mark it unavailable.")
    # Validation
    if not biz_data.get("name"):
        raise HTTPException(status_code=400, detail="Business Name is required.")
    if not agent_data.get("name"):
        raise HTTPException(status_code=400, detail="Agent Name is required.")
    voice_data = voice_data or {"voice_id": "scadova_voice_default", "voice_name": "Default Voice"}

    # 1. Attach router tools based on business type
    b_type = biz_data.get("type", "service_and_appointment")
    tools = get_router_tools_for_business_type(b_type)
    agent_runtime_id = f"agent_{uuid.uuid4().hex[:12]}"

    # 4. Associate or Save Business to Database
    existing_biz_id = biz_data.get("id")
    existing_biz = data_store.get_business(existing_biz_id) if existing_biz_id else None
    if not existing_biz:
        # Search by name match
        for b in data_store.list_businesses():
            if b.get("name", "").strip().lower() == biz_data.get("name", "").strip().lower():
                existing_biz = b
                break

    if existing_biz:
        biz_id = existing_biz["id"]
        updates = {
            "agent_name": agent_data["name"],
            "agent_id": agent_runtime_id,
            "fish_agent_id": agent_runtime_id,
            "voice": voice_data.get("voice_name", "Selected Voice"),
            "voice_id": voice_data.get("voice_id", "scadova_voice_default"),
            "language": agent_data.get("language", "en"),
            "llm": f"{llm_data.get('provider', 'Scadova Runtime')} / {llm_data.get('model', 'scadova-routing-v1')}",
            "last_synced_at": _now_iso()
        }
        data_store.update_business(biz_id, updates)
        saved_biz = {**existing_biz, **updates}
    else:
        biz_record = {
            "name": biz_data["name"],
            "type": b_type,
            "business_type": b_type,
            "industry": biz_data.get("industry", "Service & Consultation"),
            "country": biz_data.get("country", "United States"),
            "timezone": biz_data.get("timezone", "America/New_York"),
            "phone": biz_data.get("phone", ""),
            "email": biz_data.get("email", ""),
            "website": biz_data.get("website", ""),
            "address": biz_data.get("address", ""),
            "description": biz_data.get("description", ""),
            "logo_url": biz_data.get("logo", ""),
            "agent_id": agent_runtime_id,
            "fish_agent_id": agent_runtime_id,
            "agent_name": agent_data["name"],
            "language": agent_data.get("language", "en"),
            "voice": voice_data.get("voice_name", "Selected Voice"),
            "voice_id": voice_data.get("voice_id", "scadova_voice_default"),
            "llm": f"{llm_data.get('provider', 'Scadova Runtime')} / {llm_data.get('model', 'scadova-routing-v1')}",
            "prompt_version": "local-v1",
            "status": "active"
        }
        saved_biz = data_store.add_business(biz_record)
        biz_id = saved_biz["id"]

    # 5. Save Agent to Database
    agent_record = {
        "business_id": biz_id,
        "business_name": saved_biz["name"],
        "business_type": b_type,
        "name": agent_data["name"],
        "role": agent_data.get("role", "Appointment Specialist"),
        "fish_agent_id": agent_runtime_id,
        "agent_id": agent_runtime_id,
        "voice_id": voice_data.get("voice_id", "scadova_voice_default"),
        "voice_name": voice_data.get("voice_name", "Selected Voice"),
        "language": agent_data.get("language", "en"),
        "accent": agent_data.get("accent", "Standard"),
        "llm_provider": llm_data.get("provider", "Scadova Runtime"),
        "llm_model": llm_data.get("model", "scadova-routing-v1"),
        "hours_data": hours_data,
        "services_data": services_data,
        "features_data": features_data,
        "rules_data": payload.rules_data,
        "first_message": agent_data.get("first_message", "Hello! How can I assist you?"),
        "prompt_version_id": None,
        "prompt_version": "local-v1",
        "attached_tools": [t["name"] for t in tools],
        "integrations": ["Scadova Router", "Twilio", "Google Calendar"],
        "status": "active"
    }
    saved_agent = data_store.add_agent(agent_record)

    # Persist catalogue services to Supabase if configured
    if services_data and biz_id:
        try:
            from backend.core.supabase import supabase
            for s in services_data:
                s_name = (s.get("service_name") or s.get("name") or "").strip()
                if s_name:
                    s_price = s.get("price")
                    s_dur = s.get("duration_minutes")
                    s_desc = (s.get("description") or s.get("short_description") or "").strip()
                    supabase.table("services").insert({
                        "business_id": biz_id,
                        "service_name": s_name,
                        "short_description": s_desc,
                        "detailed_description": s_desc,
                        "price": float(s_price) if s_price is not None and str(s_price).strip() != "" else None,
                        "duration_minutes": int(s_dur) if s_dur is not None and str(s_dur).strip() != "" else None,
                        "active": True
                    }).execute()
        except Exception as e:
            logger.debug(f"Catalogue services table sync: {e}")

    return {
        "success": True,
        "status": "Local Saved",
        "agent_id": agent_runtime_id,
        "business": saved_biz,
        "agent": saved_agent,
        "tools_attached": len(tools),
        "message": f"Agent '{agent_data['name']}' created locally with preinstalled Scadova router tools and usage tracking."
    }


# ============================================================
# 4. VOICE AGENTS DASHBOARD & ACTIONS (PHASE 2C)
# ============================================================

@router.get("/agents")
async def list_agents():
    """List local voice agents tracked by Scadova."""
    return data_store.list_agents()


@router.post("/agents", status_code=status.HTTP_201_CREATED)
async def create_agent(payload: AgentCreatePayload):
    """Direct agent creation."""
    biz = data_store.get_business(payload.business_id)
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    agent_data = payload.model_dump()
    agent_data["business_name"] = biz["name"]
    agent_data["business_type"] = biz.get("type", "service_and_appointment")
    agent = data_store.add_agent(agent_data)
    return agent


@router.get("/agents/{agent_id}")
async def get_agent(agent_id: str):
    agent = data_store.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.put("/agents/{agent_id}")
async def update_agent(agent_id: str, updates: Dict[str, Any]):
    agent = data_store.update_agent(agent_id, updates)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.post("/agents/{agent_id}/sync")
async def sync_agent(agent_id: str):
    """Mark a local agent as ready after configuration changes."""
    target_agent = data_store.get_agent(agent_id)
    if not target_agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {"success": True, "agent": target_agent, "message": "Local agent configuration is ready."}


@router.post("/agents/{agent_id}/test")
async def test_agent_message(agent_id: str, payload: AgentTestPayload):
    """Simulate conversation turn with agent."""
    target_agent = data_store.get_agent(agent_id)
    if not target_agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    user_msg = payload.message.lower()
    if "price" in user_msg or "cost" in user_msg:
        reply = f"Our standard service plans start at $45/month with enterprise custom packages available. May I help you schedule a demo?"
    elif "hour" in user_msg or "open" in user_msg:
        reply = f"Our automated voice service is operational 24/7, and representative support is available Monday to Friday 9 AM to 6 PM EST."
    elif "book" in user_msg or "appointment" in user_msg or "schedule" in user_msg:
        reply = f"I would be delighted to schedule that for you. What date and time works best for your appointment?"
    else:
        reply = f"Thank you for contacting {target_agent.get('business_name', 'Scadova AI')}. I am {target_agent['name']}, your Scadova AI assistant. How may I assist you right now?"

    return {
        "success": True,
        "agent_name": target_agent["name"],
        "voice_name": target_agent.get("voice_name"),
        "user_message": payload.message,
        "agent_response": reply
    }



# ============================================================
# 5. CALL LOGS & COST TRACKING (PHASE 2C)
# ============================================================

@router.get("/call_logs")
async def list_call_logs():
    """List all calls with duration, transcript, recordings, and cost breakdown."""
    return data_store.list_calls()


@router.post("/call_logs", status_code=status.HTTP_201_CREATED)
async def create_call_log(payload: CallLogPayload):
    """Record a call with configuration snapshot at call time."""
    biz = data_store.get_business(payload.business_id)
    agent = data_store.get_agent(payload.agent_id)

    # Snapshot configuration
    snapshot = {
        "voice_id": agent.get("voice_id") if agent else "default",
        "voice_name": agent.get("voice_name") if agent else "Default",
        "llm_provider": agent.get("llm_provider") if agent else "Scadova Runtime",
        "llm_model": agent.get("llm_model") if agent else "scadova-routing-v1",
        "prompt_version": agent.get("prompt_version") if agent else "local-v1"
    }

    call_dict = payload.model_dump()
    call_dict["business_name"] = biz["name"] if biz else f"Business #{payload.business_id}"
    call_dict["agent_name"] = agent["name"] if agent else f"Agent #{payload.agent_id}"
    call_dict["agent_id"] = agent.get("agent_id") or agent.get("fish_agent_id") if agent else payload.agent_id
    call_dict["fish_agent_id"] = call_dict["agent_id"]
    call_dict["voice_name"] = snapshot["voice_name"]
    call_dict["llm_model"] = snapshot["llm_model"]
    call_dict["prompt_version"] = snapshot["prompt_version"]
    call_dict["actual_minutes"] = round(payload.duration_seconds / 60.0, 2)
    call_dict["billable_minutes"] = float(int(payload.duration_seconds / 60.0) + (1 if payload.duration_seconds % 60 else 0))
    call_dict["config_snapshot"] = snapshot

    new_call = data_store.add_call(call_dict)
    return new_call


@router.get("/agent-usage")
async def get_agent_usage_tracking():
    """
    Track call analysis, used minutes, credits consumed, remaining balance,
    and credit limits for every available voice agent.
    """
    return data_store.get_agent_usage_summary()


@router.get("/agents/{agent_id}/credits")
async def get_agent_credits(agent_id: str):
    """Return credit settings and usage summary for a single agent ID."""
    settings = data_store.get_agent_credit_settings(agent_id)
    if not settings:
        raise HTTPException(status_code=404, detail="Agent not found")
    usage = data_store.get_agent_usage_summary()
    agent_usage = next((a for a in usage["agents"] if str(a["agent_id"]) == str(settings["agent_id"])), None)
    return {"success": True, "settings": settings, "usage": agent_usage}


@router.put("/agents/{agent_id}/credit-limit")
async def set_agent_credit_limit(agent_id: str, payload: AgentCreditLimitPayload):
    """Set an agent credit limit and optional credits-per-minute rate."""
    try:
        with data_store.state_lock:
            settings = data_store.set_agent_credit_limit(
                agent_id, payload.credit_limit, payload.credits_per_minute, payload.low_balance_threshold,
            )
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    if not settings:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {"success": True, "settings": settings, "usage": data_store.get_agent_usage_summary()}


@router.post("/agents/{agent_id}/credits")
async def add_agent_credits(agent_id: str, payload: AgentCreditTopUpPayload):
    """Add credits to an agent balance up to the configured credit limit."""
    try:
        with data_store.state_lock:
            settings = data_store.add_agent_credits(agent_id, payload.amount, payload.note or "")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not settings:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {"success": True, "settings": settings, "usage": data_store.get_agent_usage_summary()}


# ============================================================
# 6. APPOINTMENTS & LEADS ENDPOINTS
# ============================================================

@router.get("/appointments")
async def list_appointments(business_id: Optional[str] = None):
    """Retrieve all appointments across businesses."""
    return data_store.list_appointments(business_id)


@router.get("/leads")
async def list_leads():
    """Retrieve all qualified leads and inquiries."""
    return data_store.list_leads()


# ============================================================
# 7. INTEGRATIONS ENDPOINTS (PHASE 2C)
# ============================================================

@router.get("/integrations")
async def list_integrations():
    """List integrations status (Twilio, Gmail, Google Calendar, WhatsApp, Webhook, Custom)."""
    return data_store.list_integrations()


@router.post("/integrations/{name}/configure")
async def configure_integration(name: str, payload: IntegrationConfigurePayload):
    """Save configuration credentials for an integration (masked after save)."""
    updated = data_store.configure_integration(name, payload.config)
    return {"success": True, "integration": updated}


@router.post("/integrations/{name}/disconnect")
async def disconnect_integration(name: str):
    """Disconnect an integration."""
    success = data_store.disconnect_integration(name)
    return {"success": success}


@router.post("/integrations/{name}/test")
async def test_integration(name: str):
    """Test connectivity for an integration."""
    raise HTTPException(status_code=501, detail="Connection test is not implemented for this provider.")


# ============================================================
# 8. PROMPT VERSIONS (PHASE 2C)
# ============================================================

@router.get("/prompt_versions")
async def list_prompt_versions():
    """List all prompt versions with history and diff capability."""
    return data_store.list_prompt_versions()


@router.post("/prompt_versions/{version_id}/publish")
async def publish_prompt(version_id: int):
    """Publish a prompt version to live voice agents."""
    p = data_store.publish_prompt_version(version_id)
    if not p:
        raise HTTPException(status_code=404, detail="Prompt version not found")
    return {"success": True, "prompt": p}


# ============================================================
# 9. API EXPLORER TELEMETRY & SYSTEM LOGS
# ============================================================

@router.get("/api-metrics")
async def get_api_metrics():
    """Telemetry for API Explorer (success count, failure count, latency)."""
    return data_store.get_api_metrics()


@router.get("/logs")
async def list_system_logs():
    """List system event logs."""
    return data_store.list_logs()


@router.get("/usage")
async def get_usage_and_cost():
    """Detailed analytics on voice minutes, LLM token costs, and telephony."""
    businesses = data_store.list_businesses()
    calls = data_store.list_calls()
    agent_usage = data_store.get_agent_usage_summary()

    total_actual_min = sum([c.get("actual_minutes", 0) for c in calls])
    total_billable_min = sum([c.get("billable_minutes", 0) for c in calls])
    total_voice_cost = sum([c.get("voice_cost", 0) for c in calls])
    total_llm_cost = sum([c.get("llm_cost", 0) for c in calls])
    total_telephony_cost = sum([c.get("telephony_cost", 0) for c in calls])

    return {
        "success": True,
        "total_calls": len(calls),
        "actual_minutes": round(total_actual_min, 2),
        "billable_minutes": round(total_billable_min, 2),
        "voice_cost": round(total_voice_cost, 4),
        "llm_cost": round(total_llm_cost, 4),
        "telephony_cost": round(total_telephony_cost, 4),
        "total_cost": round(total_voice_cost + total_llm_cost + total_telephony_cost, 4),
        "agent_credit_tracking": agent_usage,
        "breakdown_by_business": [
            {
                "business_name": b["name"],
                "calls": b.get("calls", 0),
                "minutes": b.get("minutes", 0),
                "cost": b.get("cost", 0)
            }
            for b in businesses
        ]
    }

from backend.admin.fish_audio import router as fish_router
router.include_router(fish_router)
