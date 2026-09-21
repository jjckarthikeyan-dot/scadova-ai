from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


# ============================================================
# SERVICE SCHEMAS
# ============================================================

class ServiceCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    business_id: str = Field(..., description="Business key identifier")
    service_name: str = Field(..., min_length=2, max_length=200, description="Name of the service")
    short_description: Optional[str] = Field(default=None, max_length=500)
    detailed_description: Optional[str] = None
    price: Optional[float] = Field(default=None, ge=0)
    duration_minutes: Optional[int] = Field(default=None, ge=5, le=480, description="Service duration in minutes")
    active: bool = Field(default=True)


class ServiceResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: Any
    business_id: Any
    service_name: str
    short_description: Optional[str] = None
    detailed_description: Optional[str] = None
    price: Optional[float] = None
    duration_minutes: Optional[int] = None
    active: bool = True
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ServiceDetailsRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    business_id: Optional[str] = None
    service_id: Optional[Any] = None
    service_name: Optional[str] = None
    service: Optional[str] = None


# ============================================================
# BUSINESS HOURS SCHEMAS
# ============================================================

class DayHours(BaseModel):
    model_config = ConfigDict(extra="ignore")

    day: str = Field(..., description="Day of week, e.g. monday")
    open_time: Optional[str] = Field(default=None, description="Opening time HH:MM in 24h format")
    close_time: Optional[str] = Field(default=None, description="Closing time HH:MM in 24h format")
    closed: bool = Field(default=False, description="If true, business is closed this day")


class BusinessHoursUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    business_id: str
    hours: List[DayHours]
    holiday_hours: Optional[str] = Field(default=None, description="Holiday schedule notes")
    after_hours_message: Optional[str] = Field(default=None, description="Message when business is closed")


class BusinessHoursResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: Any
    business_id: Any
    day: str
    open_time: Optional[str] = None
    close_time: Optional[str] = None
    closed: bool = False
    created_at: Optional[str] = None


# ============================================================
# APPOINTMENT SCHEMAS
# ============================================================

class AppointmentCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    business_id: str = Field(..., description="Business key identifier")
    service_id: Optional[int] = Field(default=None, description="Service ID from services table")
    service_name: Optional[str] = Field(default=None, description="Service name for reference")

    customer_name: str = Field(..., min_length=2, max_length=150)
    customer_phone: str = Field(..., min_length=8, max_length=20)
    customer_email: Optional[str] = Field(default=None, max_length=200)

    appointment_date: str = Field(..., description="Date in YYYY-MM-DD format")
    appointment_time: str = Field(..., description="Time in HH:MM 24h format")
    duration_minutes: Optional[int] = Field(default=None, ge=5, le=480)

    notes: Optional[str] = None
    source: Optional[str] = Field(default="voice_agent")


class AppointmentResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: Any
    appointment_id: Optional[str] = None
    business_id: Any
    service_id: Optional[int] = None
    service_name: Optional[str] = None

    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None

    appointment_date: str
    appointment_time: str
    duration_minutes: Optional[int] = None

    status: Optional[str] = "CONFIRMED"
    notes: Optional[str] = None
    source: Optional[str] = None

    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class AppointmentSearchRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    business_id: str
    appointment_id: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    appointment_date: Optional[str] = None


class AppointmentRescheduleRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    business_id: str
    appointment_id: str = Field(..., description="Appointment ID to reschedule")
    new_date: str = Field(..., description="New date in YYYY-MM-DD format")
    new_time: str = Field(..., description="New time in HH:MM 24h format")
    reason: Optional[str] = None


class AppointmentCancelRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    business_id: str
    appointment_id: str = Field(..., description="Appointment ID to cancel")
    reason: Optional[str] = None
