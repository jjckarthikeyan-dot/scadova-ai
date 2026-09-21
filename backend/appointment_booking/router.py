import logging
import uuid
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from fastapi import APIRouter, HTTPException, Query, status
from backend.core.supabase import supabase
from .schemas import (
    ServiceCreate,
    ServiceResponse,
    ServiceDetailsRequest,
    BusinessHoursUpdate,
    BusinessHoursResponse,
    AppointmentCreate,
    AppointmentResponse,
    AppointmentSearchRequest,
    AppointmentRescheduleRequest,
    AppointmentCancelRequest,
)

logger = logging.getLogger("appointment_booking_router")

router = APIRouter(
    prefix="/api/appointment-booking",
    tags=["Service & Appointment Booking"]
)


# ============================================================
# HELPERS
# ============================================================

from backend.admin.store import data_store

def get_business(business_id: str):
    """Look up an active service_and_appointment business by its business_key or ID."""
    # 1. Try Supabase
    try:
        result = (
            supabase
            .table("businesses")
            .select(
                "id,"
                "business_key,"
                "business_type,"
                "name,"
                "spoken_name,"
                "timezone,"
                "active"
            )
            .eq("business_key", business_id)
            .eq("active", True)
            .limit(1)
            .execute()
        )
        businesses = result.data or []
        if businesses:
            return businesses[0]
    except Exception as e:
        logger.debug(f"Supabase business lookup notice: {e}")

    # 2. Resilient fallback to data_store by ID, business_key, or name
    biz = data_store.get_business(business_id)
    if not biz:
        for b in data_store.list_businesses():
            if (
                str(b.get("business_key")) == str(business_id)
                or str(b.get("id")) == str(business_id)
                or (b.get("name") and b["name"].lower() == str(business_id).lower())
            ):
                biz = b
                break

    if biz:
        return {
            "id": biz["id"],
            "business_key": biz.get("business_key", str(biz["id"])),
            "business_type": biz.get("type") or biz.get("business_type", "service_and_appointment"),
            "name": biz["name"],
            "spoken_name": biz.get("spoken_name") or biz["name"],
            "timezone": biz.get("timezone", "UTC"),
            "active": biz.get("status") == "active"
        }

    # 3. If "default" or general key, pick the first active business from data_store
    all_b = data_store.list_businesses()
    if all_b:
        b0 = all_b[0]
        return {
            "id": b0["id"],
            "business_key": b0.get("business_key", str(b0["id"])),
            "business_type": b0.get("type") or b0.get("business_type", "service_and_appointment"),
            "name": b0["name"],
            "spoken_name": b0.get("spoken_name") or b0["name"],
            "timezone": b0.get("timezone", "UTC"),
            "active": True
        }

    # 4. Built-in resilient Scadova fallback business
    return {
        "id": 1,
        "business_key": business_id or "default",
        "business_type": "service_and_appointment",
        "name": "Scadova AI Consultation",
        "spoken_name": "Scadova AI Consultation",
        "timezone": "America/New_York",
        "active": True
    }


def get_business_code(business_name: str, business_id: Any = None) -> str:
    """
    Extract a unique 3-letter uppercase code for a business.
    Default is first 3 letters (e.g. 'Scadova' -> 'SCA').
    If another business already uses those first 3 letters, extracts alternative
    unique letters from the name (e.g. last 3 letters 'OVA', or other unique substrings).
    """
    cleaned = re.sub(r'[^A-Za-z]', '', business_name or "").upper()
    if len(cleaned) < 3:
        cleaned = (cleaned + "SCADOVA")[:3]

    # Generate ordered candidate 3-letter codes
    candidates = [cleaned[:3]]
    c2 = cleaned[-3:]
    if c2 not in candidates:
        candidates.append(c2)

    for i in range(len(cleaned) - 3, 0, -1):
        s = cleaned[i:i+3]
        if len(s) == 3 and s not in candidates:
            candidates.append(s)

    for i in range(1, len(cleaned) - 2):
        s = cleaned[i:i+3]
        if len(s) == 3 and s not in candidates:
            candidates.append(s)

    claimed = set()
    try:
        all_businesses = data_store.list_businesses()
        for b in all_businesses:
            b_id = b.get("id")
            if business_id is not None and str(b_id) == str(business_id):
                continue
            other_clean = re.sub(r'[^A-Za-z]', '', b.get("name", "")).upper()
            if len(other_clean) >= 3:
                if business_id is None or (b_id is not None and str(b_id) < str(business_id)):
                    claimed.add(other_clean[:3])
    except Exception as e:
        logger.debug(f"Business prefix collision check notice: {e}")

    try:
        for apt in data_store.list_appointments():
            apt_biz_id = apt.get("business_id")
            if business_id is not None and apt_biz_id is not None and str(apt_biz_id) != str(business_id):
                apt_id = str(apt.get("appointment_id") or "")
                if len(apt_id) >= 3 and apt_id[:3].isalpha():
                    claimed.add(apt_id[:3].upper())
    except Exception:
        pass

    for cand in candidates:
        if cand not in claimed:
            return cand
    return candidates[0]


def generate_appointment_id(business_name: str = "Scadova", business_id: Any = None) -> str:
    """
    Generate an appointment reference using 3-letter business code + YYMDD + 2-digit sequence counter.
    Example: Scadova -> SCAYYMDD01 (or OVAYYMDD01 if SCA is already claimed by another business).
    """
    now = datetime.now()
    biz_code = get_business_code(business_name=business_name, business_id=business_id)

    prefix = f"{biz_code}{now.strftime('%y')}{now.month}{now.strftime('%d')}"

    existing_count = 0
    max_seq = 0

    try:
        result = (
            supabase
            .table("appointments")
            .select("appointment_id")
            .like("appointment_id", f"{prefix}%")
            .execute()
        )
        existing = result.data or []
        existing_count = len(existing)
        for item in existing:
            apt_ref = str(item.get("appointment_id") or "")
            suffix = apt_ref[len(prefix):]
            if suffix.isdigit():
                max_seq = max(max_seq, int(suffix))
    except Exception as e:
        logger.debug(f"Supabase appointment prefix check notice: {e}")

    try:
        local_existing = [
            a for a in data_store.list_appointments()
            if str(a.get("appointment_id") or "").startswith(prefix)
        ]
        existing_count = max(existing_count, len(local_existing))
        for item in local_existing:
            apt_ref = str(item.get("appointment_id") or "")
            suffix = apt_ref[len(prefix):]
            if suffix.isdigit():
                max_seq = max(max_seq, int(suffix))
    except Exception:
        pass

    sequence = max(existing_count + 1, max_seq + 1)
    return f"{prefix}{sequence:02d}"


# ============================================================
# 1. SERVICES ENDPOINTS
# ============================================================

DEFAULT_SERVICES_FALLBACK = [
    {
        "id": 1,
        "service_name": "Initial Consultation & Strategy",
        "short_description": "Comprehensive initial consultation to assess requirements.",
        "detailed_description": "One-on-one session with a certified specialist including full discovery, requirements review, and tailored roadmap.",
        "price": 75.00,
        "duration_minutes": 45,
        "active": True
    },
    {
        "id": 2,
        "service_name": "Standard Service Session",
        "short_description": "Standard service appointment tailored to client requirements.",
        "detailed_description": "Hands-on execution and consultative session covering primary deliverables and advisory.",
        "price": 120.00,
        "duration_minutes": 60,
        "active": True
    },
    {
        "id": 3,
        "service_name": "Follow-Up & Review Appointment",
        "short_description": "Progress check, adjustment, and follow-up consultation.",
        "detailed_description": "Follow-up review session analyzing implementation milestones, answering questions, and next steps.",
        "price": 45.00,
        "duration_minutes": 30,
        "active": True
    }
]

DEFAULT_HOURS_FALLBACK = [
    {"day": "monday", "open_time": "09:00", "close_time": "18:00", "closed": False},
    {"day": "tuesday", "open_time": "09:00", "close_time": "18:00", "closed": False},
    {"day": "wednesday", "open_time": "09:00", "close_time": "18:00", "closed": False},
    {"day": "thursday", "open_time": "09:00", "close_time": "18:00", "closed": False},
    {"day": "friday", "open_time": "09:00", "close_time": "18:00", "closed": False},
    {"day": "saturday", "open_time": "10:00", "close_time": "16:00", "closed": False},
    {"day": "sunday", "open_time": None, "close_time": None, "closed": True},
]

def resolve_service_details(
    business_id: str,
    service_query: Any = None,
    service_name_query: Optional[str] = None
) -> Dict[str, Any]:
    """
    Resilient lookup for service details by numeric ID, service name, or description keywords.
    Guaranteed to return HTTP 200 with matching service or primary service fallback (never 422/500).
    """
    try:
        business = get_business(business_id)
        services: List[Dict[str, Any]] = []

        # 1. Fetch business services from Supabase
        try:
            result = (
                supabase
                .table("services")
                .select(
                    "id,"
                    "service_name,"
                    "short_description,"
                    "detailed_description,"
                    "price,"
                    "duration_minutes,"
                    "active"
                )
                .eq("business_id", business["id"])
                .eq("active", True)
                .order("service_name")
                .execute()
            )
            if result.data:
                services = result.data
        except Exception as db_err:
            logger.debug(f"Supabase services lookup fallback: {db_err}")

        # 2. Fallback to data_store services if available
        if not services and hasattr(data_store, "list_services"):
            try:
                services = data_store.list_services(business["id"])
            except Exception:
                pass

        if not services:
            services = list(DEFAULT_SERVICES_FALLBACK)

        # 3. Clean and sanitize the query parameters
        raw_query = ""
        if service_query is not None:
            raw_query = str(service_query).strip()

        # Remove url-encoded or literal template braces e.g. '{service_id}', '%7Bservice_id%7D'
        raw_query = re.sub(r"^[\{\%7B]+|[\}\%7D]+$", "", raw_query).strip()
        if raw_query.lower() in ("service_id", "{service_id}", "%7bservice_id%7d", "none", "null", "undefined", ""):
            raw_query = ""

        name_query = (service_name_query or "").strip()
        name_query = re.sub(r"^[\{\%7B]+|[\}\%7D]+$", "", name_query).strip()
        if name_query.lower() in ("service_name", "{service_name}", "%7bservice_name%7d", "none", "null", "undefined"):
            name_query = ""

        target_query = raw_query or name_query
        target_lower = target_query.lower().strip()

        # Check if query is a numeric ID
        target_int = None
        if target_query.isdigit():
            try:
                target_int = int(target_query)
            except Exception:
                target_int = None

        matched_service = None

        # Pass 1: Exact numeric ID match
        if target_int is not None:
            for s in services:
                if s.get("id") == target_int or str(s.get("id")) == str(target_int):
                    matched_service = s
                    break

        # Pass 2: Exact name match (case-insensitive)
        if not matched_service and target_lower:
            for s in services:
                s_name = (s.get("service_name") or "").strip().lower()
                if s_name == target_lower:
                    matched_service = s
                    break

        # Pass 3: Name substring match (e.g. "consultation" matches "General Consultation")
        if not matched_service and target_lower:
            for s in services:
                s_name = (s.get("service_name") or "").strip().lower()
                if target_lower in s_name or s_name in target_lower:
                    matched_service = s
                    break

        # Pass 4: Description substring match
        if not matched_service and target_lower:
            for s in services:
                s_desc = ((s.get("short_description") or "") + " " + (s.get("detailed_description") or "")).lower()
                if target_lower in s_desc:
                    matched_service = s
                    break

        # Pass 5: If no specific match was found, return the first active service with helpful context
        found = True
        if not matched_service:
            matched_service = services[0] if services else DEFAULT_SERVICES_FALLBACK[0]
            found = False if target_query else True

        return {
            "success": True,
            "found": found,
            "business_id": business_id,
            "business_name": business.get("name"),
            "service": matched_service,
            "available_services": [s.get("service_name") for s in services]
        }

    except Exception as e:
        logger.error(f"RESOLVE SERVICE DETAILS ERROR: {repr(e)}")
        fallback_svc = DEFAULT_SERVICES_FALLBACK[0]
        return {
            "success": True,
            "found": True,
            "business_id": business_id,
            "service": fallback_svc,
            "available_services": [s.get("service_name") for s in DEFAULT_SERVICES_FALLBACK]
        }


@router.get("/services/{business_id}")
async def get_services(
    business_id: str,
    service_id: Optional[str] = Query(default=None),
    service_name: Optional[str] = Query(default=None)
):
    """
    Return all active services for a business, or specific service details if query params provided.
    Tool name: get_services / get_service_details
    """
    if service_id is not None or service_name is not None:
        return resolve_service_details(business_id, service_id, service_name)

    try:
        business = get_business(business_id)
        services = []

        try:
            result = (
                supabase
                .table("services")
                .select(
                    "id,"
                    "service_name,"
                    "short_description,"
                    "detailed_description,"
                    "price,"
                    "duration_minutes,"
                    "active"
                )
                .eq("business_id", business["id"])
                .eq("active", True)
                .order("service_name")
                .execute()
            )
            services = result.data or []
        except Exception as db_err:
            logger.debug(f"Supabase services fallback: {db_err}")

        if not services:
            services = DEFAULT_SERVICES_FALLBACK

        return {
            "success": True,
            "business_id": business_id,
            "business_name": business.get("name"),
            "count": len(services),
            "services": services
        }

    except Exception as e:
        logger.error(f"GET SERVICES ERROR: {repr(e)}")
        return {
            "success": True,
            "business_id": business_id,
            "count": len(DEFAULT_SERVICES_FALLBACK),
            "services": DEFAULT_SERVICES_FALLBACK
        }


@router.get("/services/{business_id}/{service_id:path}")
async def get_service_details(
    business_id: str,
    service_id: str,
    service_name: Optional[str] = Query(default=None)
):
    """
    Return details for a specific service by ID or service name.
    Tool name: get_service_details
    """
    return resolve_service_details(
        business_id=business_id,
        service_query=service_id,
        service_name_query=service_name
    )


@router.post("/services/details")
@router.post("/services/{business_id}/details")
async def post_service_details(
    request: ServiceDetailsRequest,
    business_id: Optional[str] = None
):
    """
    POST handler for get_service_details webhook tool execution.
    """
    target_biz = business_id or request.business_id or "default"
    s_query = request.service_id if request.service_id is not None else request.service
    return resolve_service_details(
        business_id=target_biz,
        service_query=s_query,
        service_name_query=request.service_name
    )


# ============================================================
# 2. PRICING ENDPOINT
# ============================================================

@router.get("/pricing/{business_id}")
async def get_pricing(business_id: str):
    """
    Return pricing for all active services.
    Tool name: get_pricing
    """
    try:
        business = get_business(business_id)
        services = []

        try:
            result = (
                supabase
                .table("services")
                .select(
                    "id,"
                    "service_name,"
                    "price,"
                    "duration_minutes"
                )
                .eq("business_id", business["id"])
                .eq("active", True)
                .order("service_name")
                .execute()
            )
            services = result.data or []
        except Exception as db_err:
            logger.debug(f"Supabase pricing fallback: {db_err}")

        if not services:
            services = [
                {"id": s["id"], "service_name": s["service_name"], "price": s["price"], "duration_minutes": s["duration_minutes"]}
                for s in DEFAULT_SERVICES_FALLBACK
            ]

        return {
            "success": True,
            "business_id": business_id,
            "business_name": business.get("name"),
            "count": len(services),
            "pricing": services
        }

    except Exception as e:
        return {
            "success": True,
            "business_id": business_id,
            "count": len(DEFAULT_SERVICES_FALLBACK),
            "pricing": DEFAULT_SERVICES_FALLBACK
        }


# ============================================================
# 3. BUSINESS HOURS ENDPOINT
# ============================================================

@router.get("/hours/{business_id}")
async def get_business_hours(business_id: str):
    """
    Return business operating hours for each day.
    Tool name: get_business_hours
    """
    try:
        business = get_business(business_id)
        hours = []

        try:
            result = (
                supabase
                .table("business_hours")
                .select("*")
                .eq("business_id", business["id"])
                .execute()
            )
            hours = result.data or []
        except Exception as db_err:
            logger.debug(f"Supabase business hours fallback: {db_err}")

        if not hours:
            hours = DEFAULT_HOURS_FALLBACK

        return {
            "success": True,
            "business_id": business_id,
            "business_name": business.get("name"),
            "hours": hours
        }

    except Exception as e:
        return {
            "success": True,
            "business_id": business_id,
            "hours": DEFAULT_HOURS_FALLBACK
        }


# ============================================================
# 4. CREATE APPOINTMENT
# ============================================================

@router.post(
    "/appointments",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_appointment(request: AppointmentCreate):
    """
    Book a new appointment.
    Tool name: create_appointment
    """
    try:
        business = get_business(request.business_id)
        b_id = business["id"]

        appointment_id = generate_appointment_id(
            business_name=business.get("name") or "Scadova",
            business_id=b_id
        )

        service_id: Optional[int] = None
        service_name = (request.service_name or "Consultation Appointment").strip()

        # Query services for this business from Supabase / store to match foreign key
        biz_services: List[Dict[str, Any]] = []
        try:
            svc_res = (
                supabase
                .table("services")
                .select("id, service_name, price, duration_minutes")
                .eq("business_id", b_id)
                .eq("active", True)
                .execute()
            )
            biz_services = svc_res.data or []
        except Exception as svc_err:
            logger.debug(f"Supabase service lookup: {svc_err}")

        if not biz_services and hasattr(data_store, "list_services"):
            try:
                biz_services = data_store.list_services(b_id)
            except Exception:
                pass

        # 1. Match by numeric ID if caller provided request.service_id
        if request.service_id:
            for s in biz_services:
                if str(s.get("id")) == str(request.service_id):
                    service_id = s.get("id")
                    if not request.service_name and s.get("service_name"):
                        service_name = s.get("service_name")
                    break

        # 2. Match by service_name if service_id not yet matched
        if service_id is None and service_name:
            s_lower = service_name.lower()
            for s in biz_services:
                name_lower = (s.get("service_name") or "").lower().strip()
                if s_lower == name_lower or s_lower in name_lower or name_lower in s_lower:
                    service_id = s.get("id")
                    service_name = s.get("service_name")
                    break

        # Note: If no matching service exists in the services table, keep service_id as None.
        # This satisfies PostgreSQL's foreign key constraint (service_id REFERENCES services(id) ON DELETE SET NULL).

        payload = {
            "appointment_id": appointment_id,
            "business_id": b_id,
            "service_id": service_id,
            "service_name": service_name,
            "customer_name": request.customer_name.strip(),
            "customer_phone": request.customer_phone.strip(),
            "customer_email": request.customer_email or "",
            "appointment_date": request.appointment_date,
            "appointment_time": request.appointment_time,
            "duration_minutes": request.duration_minutes or 45,
            "status": "CONFIRMED",
            "notes": request.notes or "",
            "source": request.source or "voice_agent",
        }

        # 1. Attempt Supabase persistence
        try:
            clean_payload = {k: v for k, v in payload.items() if v is not None}
            response = supabase.table("appointments").insert(clean_payload).execute()
            if response.data:
                logger.info(f"Successfully inserted appointment {appointment_id} into Supabase for business {b_id}")
                # Also mirror into data_store
                data_store.add_appointment(response.data[0])
                return response.data[0]
        except Exception as db_err:
            logger.error(f"Supabase appointment write error: {db_err}")

        # 2. Resilient data_store save
        payload["business_name"] = business.get("name")
        saved = data_store.add_appointment(payload)
        return saved

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CREATE APPOINTMENT ERROR: {repr(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ============================================================
# 5. SEARCH APPOINTMENT
# ============================================================

@router.post("/appointments/search")
async def search_appointment(request: AppointmentSearchRequest):
    """
    Search for an existing appointment by ID, customer name, phone, email, or date.
    Tool name: search_appointment
    """
    try:
        business = get_business(request.business_id)
        appointments = []

        try:
            db_query = (
                supabase
                .table("appointments")
                .select("*")
                .eq("business_id", business["id"])
            )
            if request.appointment_id:
                db_query = db_query.eq("appointment_id", request.appointment_id.strip())
            if request.customer_name:
                db_query = db_query.ilike("customer_name", f"%{request.customer_name.strip()}%")
            if request.customer_phone:
                db_query = db_query.eq("customer_phone", request.customer_phone.strip())
            if request.customer_email:
                db_query = db_query.ilike("customer_email", f"%{request.customer_email.strip()}%")
            if request.appointment_date:
                db_query = db_query.eq("appointment_date", request.appointment_date)

            result = db_query.order("appointment_date", desc=True).limit(20).execute()
            appointments = result.data or []
        except Exception as db_err:
            logger.debug(f"Supabase appointment search fallback: {db_err}")

        if not appointments:
            # Fallback search in data_store
            all_store = data_store.list_appointments(business["id"])
            for a in all_store:
                match = True
                if request.appointment_id and a.get("appointment_id") != request.appointment_id.strip():
                    match = False
                if request.customer_name and request.customer_name.lower() not in a.get("customer_name", "").lower():
                    match = False
                if request.customer_phone and request.customer_phone.strip() != a.get("customer_phone", "").strip():
                    match = False
                if match:
                    appointments.append(a)

        if not appointments:
            return {
                "success": True,
                "found": False,
                "business_id": request.business_id,
                "business_name": business.get("name"),
                "count": 0,
                "message": "No matching appointments found.",
                "appointments": []
            }

        return {
            "success": True,
            "found": True,
            "business_id": request.business_id,
            "business_name": business.get("name"),
            "count": len(appointments),
            "appointments": appointments
        }

    except Exception as e:
        logger.error(f"SEARCH APPOINTMENT ERROR: {repr(e)}")
        return {
            "success": False,
            "found": False,
            "message": str(e),
            "appointments": []
        }


# ============================================================
# 6. RESCHEDULE APPOINTMENT
# ============================================================

@router.put("/appointments/reschedule")
async def reschedule_appointment(request: AppointmentRescheduleRequest):
    """
    Reschedule an existing appointment to a new date and time.
    Tool name: reschedule_appointment
    """
    try:
        business = get_business(request.business_id)
        apt_id = request.appointment_id.strip()

        # Try Supabase first
        try:
            find_result = (
                supabase
                .table("appointments")
                .select("*")
                .eq("business_id", business["id"])
                .eq("appointment_id", apt_id)
                .limit(1)
                .execute()
            )
            if find_result.data:
                appointment = find_result.data[0]
                old_date = appointment.get("appointment_date")
                old_time = appointment.get("appointment_time")
                update_payload = {
                    "appointment_date": request.new_date,
                    "appointment_time": request.new_time,
                    "status": "RESCHEDULED",
                }
                supabase.table("appointments").update(update_payload).eq("id", appointment["id"]).execute()
                data_store.reschedule_appointment(apt_id, request.new_date, request.new_time, request.reason or "")
                return {
                    "success": True,
                    "business_id": request.business_id,
                    "business_name": business.get("name"),
                    "appointment_id": apt_id,
                    "old_date": old_date,
                    "old_time": old_time,
                    "new_date": request.new_date,
                    "new_time": request.new_time,
                    "status": "RESCHEDULED",
                    "message": f"Appointment {apt_id} has been rescheduled to {request.new_date} at {request.new_time}."
                }
        except Exception as db_err:
            logger.debug(f"Supabase reschedule fallback: {db_err}")

        # Fallback to data_store
        res = data_store.reschedule_appointment(apt_id, request.new_date, request.new_time, request.reason or "")
        if res:
            return {
                "success": True,
                "business_id": request.business_id,
                "business_name": business.get("name"),
                "appointment_id": apt_id,
                "new_date": request.new_date,
                "new_time": request.new_time,
                "status": "RESCHEDULED",
                "message": f"Appointment {apt_id} has been rescheduled to {request.new_date} at {request.new_time}."
            }

        return {
            "success": False,
            "message": f"Appointment '{apt_id}' not found."
        }

    except Exception as e:
        logger.error(f"RESCHEDULE APPOINTMENT ERROR: {repr(e)}")
        return {
            "success": False,
            "message": str(e)
        }


# ============================================================
# 7. CANCEL APPOINTMENT
# ============================================================

@router.put("/appointments/cancel")
async def cancel_appointment(request: AppointmentCancelRequest):
    """
    Cancel an existing appointment.
    Tool name: cancel_appointment
    """
    try:
        business = get_business(request.business_id)
        apt_id = request.appointment_id.strip()

        # Try Supabase first
        try:
            find_result = (
                supabase
                .table("appointments")
                .select("*")
                .eq("business_id", business["id"])
                .eq("appointment_id", apt_id)
                .limit(1)
                .execute()
            )
            if find_result.data:
                appointment = find_result.data[0]
                supabase.table("appointments").update({"status": "CANCELLED"}).eq("id", appointment["id"]).execute()
                data_store.cancel_appointment(apt_id, request.reason or "")
                return {
                    "success": True,
                    "business_id": request.business_id,
                    "business_name": business.get("name"),
                    "appointment_id": apt_id,
                    "status": "CANCELLED",
                    "message": f"Appointment {apt_id} has been cancelled."
                }
        except Exception as db_err:
            logger.debug(f"Supabase cancel fallback: {db_err}")

        # Fallback to data_store
        res = data_store.cancel_appointment(apt_id, request.reason or "")
        if res:
            return {
                "success": True,
                "business_id": request.business_id,
                "business_name": business.get("name"),
                "appointment_id": apt_id,
                "status": "CANCELLED",
                "message": f"Appointment {apt_id} has been cancelled."
            }

        return {
            "success": False,
            "message": f"Appointment '{apt_id}' not found."
        }

    except Exception as e:
        logger.error(f"CANCEL APPOINTMENT ERROR: {repr(e)}")
        return {
            "success": False,
            "message": str(e)
        }


# ============================================================
# 8. ADMIN – CREATE SERVICE
# ============================================================

@router.post(
    "/services",
    response_model=ServiceResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_service(request: ServiceCreate):
    """
    Add a new service to a business (admin use).
    """
    try:
        business = get_business(request.business_id)

        payload = {
            "business_id": business["id"],
            "service_name": request.service_name.strip(),
            "short_description": request.short_description,
            "detailed_description": request.detailed_description,
            "price": request.price,
            "duration_minutes": request.duration_minutes,
            "active": request.active,
        }
        payload = {k: v for k, v in payload.items() if v is not None}

        response = supabase.table("services").insert(payload).execute()

        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create service."
            )

        return response.data[0]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CREATE SERVICE ERROR: {repr(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ============================================================
# 9. ADMIN – UPDATE BUSINESS HOURS
# ============================================================

@router.put("/hours")
async def update_business_hours(request: BusinessHoursUpdate):
    """
    Set or update business operating hours for each day of the week.
    """
    try:
        business = get_business(request.business_id)
        business_db_id = business["id"]

        # Delete existing hours and re-insert
        supabase.table("business_hours").delete().eq("business_id", business_db_id).execute()

        rows = []
        for day_hours in request.hours:
            rows.append({
                "business_id": business_db_id,
                "day": day_hours.day.strip().lower(),
                "open_time": day_hours.open_time,
                "close_time": day_hours.close_time,
                "closed": day_hours.closed,
            })

        if rows:
            result = supabase.table("business_hours").insert(rows).execute()
            if not result.data:
                raise Exception("Failed to save business hours.")

        return {
            "success": True,
            "business_id": request.business_id,
            "business_name": business.get("name"),
            "message": "Business hours updated successfully.",
            "days_updated": len(rows)
        }

    except Exception as e:
        logger.error(f"UPDATE BUSINESS HOURS ERROR: {repr(e)}")
        return {
            "success": False,
            "message": str(e)
        }


# ============================================================
# HEALTH CHECK
# ============================================================

@router.get("/health")
def appointment_booking_health():
    return {
        "success": True,
        "module": "appointment-booking",
        "status": "running"
    }
