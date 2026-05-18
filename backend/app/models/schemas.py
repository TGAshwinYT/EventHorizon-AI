from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class ChatRequest(BaseModel):
    message: str
    user_id: Optional[str] = None
    page_context: Optional[str] = None
    language: str
    history: Optional[List[Dict[str, Any]]] = None

class TTSRequest(BaseModel):
    text: str
    language: str
    voice_preference: Optional[str] = None

class PageAnalysisRequest(BaseModel):
    page_content: str
    page_title: str
    page_url: str
    user_id: Optional[str] = None

class MemoryRequest(BaseModel):
    user_id: str
    key: str
    value: str

class ProfileResponse(BaseModel):
    username: str
    display_name: Optional[str] = None
    language: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    mandal: Optional[str] = None
    crops: Optional[List[str]] = None
    alerts_enabled: bool
    onboarding_completed: bool

class ProfileUpdateRequest(BaseModel):
    display_name: Optional[str] = None
    language: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    mandal: Optional[str] = None
    crops: Optional[List[str]] = None
    alerts_enabled: Optional[bool] = None
    onboarding_completed: Optional[bool] = None

class ResearchRequest(BaseModel):
    message: str
    language: str
    history: Optional[List[Dict[str, Any]]] = None

