from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, List, Dict, Any
from datetime import datetime

class BusinessBase(BaseModel):
    name: str = Field(..., description="Business name")
    type: str = Field(..., description="Business type, e.g., 'service_and_appointment', 'restaurant', 'loan_agency', 'custom'")
    industry: Optional[str] = None
    country: Optional[str] = None
    timezone: Optional[str] = None
    status: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[HttpUrl] = None
    website: Optional[HttpUrl] = None
    logo_url: Optional[HttpUrl] = None

class BusinessCreate(BusinessBase):
    pass

class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None
    timezone: Optional[str] = None
    status: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[HttpUrl] = None
    website: Optional[HttpUrl] = None
    logo_url: Optional[HttpUrl] = None

class BusinessOut(BusinessBase):
    id: int
    created_at: datetime
    updated_at: datetime
    fish_agent_id: Optional[str] = None
    prompt_version_id: Optional[int] = None
    class Config:
        orm_mode = True

class AgentBase(BaseModel):
    name: str
    business_id: int
    voice_id: Optional[str] = None
    language: Optional[str] = None
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None
    prompt_version_id: Optional[int] = None

class AgentCreate(AgentBase):
    pass

class AgentUpdate(BaseModel):
    name: Optional[str] = None
    voice_id: Optional[str] = None
    language: Optional[str] = None
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None

class AgentOut(AgentBase):
    id: int
    created_at: datetime
    updated_at: datetime
    class Config:
        orm_mode = True

class IntegrationBase(BaseModel):
    name: str
    business_id: int
    connected: bool = False
    config: Optional[Dict[str, Any]] = None

class IntegrationCreate(IntegrationBase):
    pass

class IntegrationOut(IntegrationBase):
    id: int
    created_at: datetime
    updated_at: datetime
    class Config:
        orm_mode = True

class CallLogBase(BaseModel):
    business_id: int
    agent_id: int
    fish_agent_id: Optional[str] = None
    voice_provider: Optional[str] = None
    voice_id: Optional[str] = None
    voice_name: Optional[str] = None
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None
    prompt_version_id: Optional[int] = None
    direction: Optional[str] = None
    caller: Optional[str] = None
    called_number: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    actual_minutes: Optional[float] = None
    billable_minutes: Optional[float] = None
    transcript: Optional[str] = None
    recording_url: Optional[HttpUrl] = None
    summary: Optional[str] = None
    outcome: Optional[str] = None
    tool_calls: Optional[List[Dict[str, Any]]] = None
    appointment_ref: Optional[str] = None
    lead_ref: Optional[str] = None
    voice_cost: Optional[float] = None
    llm_cost: Optional[float] = None
    telephony_cost: Optional[float] = None
    total_cost: Optional[float] = None

class CallLogCreate(CallLogBase):
    pass

class CallLogOut(CallLogBase):
    id: int
    created_at: datetime
    class Config:
        orm_mode = True

class PromptVersionBase(BaseModel):
    business_id: int
    version_number: int
    prompt_text: str
    changed_fields: Optional[Dict[str, Any]] = None

class PromptVersionCreate(PromptVersionBase):
    created_by: Optional[str] = None

class PromptVersionOut(PromptVersionBase):
    id: int
    created_at: datetime
    created_by: Optional[str] = None
    class Config:
        orm_mode = True
