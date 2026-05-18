import json
from fastapi import APIRouter, HTTPException, UploadFile, File, Header, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.database import get_auth_db, AuthSessionLocal
from app.models import User
from app.auth import decode_access_token

# Import Schemas
from app.models.schemas import (
    ChatRequest, 
    TTSRequest, 
    PageAnalysisRequest, 
    MemoryRequest,
    ProfileResponse,
    ProfileUpdateRequest
)

# Import Services
from app.services.gemini_service import gemini_service
from app.services.groq_service import groq_service
from app.services.tts_fallback import tts_fallback_service
from app.services.memory_service import memory_service

router = APIRouter()

# Helper to verify token and retrieve user
def get_current_user_from_token(authorization: str, db: Session) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
        
    username = payload.get("sub")
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.post('/chat')
def assistant_chat(data: ChatRequest):
    """
    POST /api/chat
    Process user voice/text query via Gemini 3 Flash.
    """
    try:
        response = gemini_service.generate_response(
            message=data.message,
            context=data.page_context or "general",
            detected_language=data.language,
            history=data.history
        )
        return {"response": response, "language": data.language}
    except Exception as e:
        print(f"[ASSISTANT CHAT ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/voice/stt')
async def voice_stt(audio: UploadFile = File(...)):
    """
    POST /api/voice/stt
    Transcribe audio blob via Groq Whisper whisper-large-v3.
    """
    try:
        audio_bytes = await audio.read()
        result = groq_service.transcribe_audio(audio_bytes, filename=audio.filename)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except Exception as e:
        print(f"[ASSISTANT STT ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/voice/tts')
def voice_tts(data: TTSRequest):
    """
    POST /api/voice/tts
    Convert text response to speech using native Gemini TTS modality, with Indic Parler TTS as fallback.
    """
    try:
        # Try primary Gemini multimodal TTS
        audio_content = gemini_service.generate_tts(text=data.text, language=data.language)
        
        # Fallback to HF Indic Parler TTS if primary fails
        if not audio_content:
            print("[TTS FALLBACK TRIGGERED] Gemini TTS failed, falling back to Indic Parler TTS on HF...")
            audio_content = tts_fallback_service.generate_speech(text=data.text, language=data.language)
            
        if not audio_content:
            raise HTTPException(status_code=500, detail="TTS generation failed in both primary and fallback engines.")
            
        # Return audio as binary stream
        return Response(content=audio_content, media_type="audio/wav")
        
    except Exception as e:
        print(f"[ASSISTANT TTS ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/page/analyze')
def page_analyze(data: PageAnalysisRequest):
    """
    POST /api/page/analyze
    Use Gemini 3 Flash to simplify and summarize the active user page context.
    """
    try:
        prompt = f"""Summarize this web page simplistically for a farmer. 
Title: {data.page_title}
URL: {data.page_url}
Content: {data.page_content}

Your reply MUST be formatted as a JSON string containing exactly:
{{
  "summary": "a short 1-2 sentence simple village-friend summary in the language of the page content",
  "key_points": ["point 1", "point 2", "point 3"],
  "suggested_questions": ["question 1", "question 2"]
}}
"""
        # Call Gemini raw response
        response_text = gemini_service.generate_response(message=prompt, context="page_analysis")
        
        # Clean potential markdown JSON fences
        cleaned = response_text.replace("```json", "").replace("```", "").strip()
        result = json.loads(cleaned)
        return result
    except Exception as e:
        print(f"[ASSISTANT PAGE ANALYZE ERROR] {e}")
        # Return generic safe fallback
        return {
            "summary": "I am looking at this page with you now. What would you like me to explain?",
            "key_points": ["Current page content loaded"],
            "suggested_questions": ["What is this page about?", "Tell me the main points here."]
        }

@router.post('/user/memory')
def user_memory(data: MemoryRequest):
    """
    POST /api/user/memory
    Save conversation memory context per user.
    """
    success = memory_service.save_memory(user_id=data.user_id, key=data.key, value=data.value)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to persist user memory.")
    return {"status": "success"}

# Unified Profile Management
@router.get('/user/profile', response_model=ProfileResponse)
def get_user_profile(authorization: str = Header(None), db: Session = Depends(get_auth_db)):
    """
    GET /api/user/profile
    Get active user profile details (including crops and alert configs).
    """
    user = get_current_user_from_token(authorization, db)
    
    # Parse crops list from text
    crops_list = []
    if user.crops:
        try:
            crops_list = json.loads(user.crops)
            if not isinstance(crops_list, list):
                crops_list = [user.crops]
        except Exception:
            crops_list = [c.strip() for c in user.crops.split(",") if c.strip()]
            
    return ProfileResponse(
        username=user.username,
        display_name=user.display_name,
        language=user.language,
        state=user.state,
        district=user.district,
        mandal=user.mandal,
        crops=crops_list,
        alerts_enabled=user.alerts_enabled == 1,
        onboarding_completed=user.onboarding_completed == 1
    )

@router.post('/user/profile', response_model=ProfileResponse)
def post_user_profile(data: ProfileUpdateRequest, authorization: str = Header(None), db: Session = Depends(get_auth_db)):
    """
    POST /api/user/profile
    Update active user profile details.
    """
    user = get_current_user_from_token(authorization, db)
    
    if data.display_name is not None:
        user.display_name = data.display_name
    if data.language is not None:
        user.language = data.language
    if data.state is not None:
        user.state = data.state
    if data.district is not None:
        user.district = data.district
    if data.mandal is not None:
        user.mandal = data.mandal
    if data.crops is not None:
        user.crops = json.dumps(data.crops)
    if data.alerts_enabled is not None:
        user.alerts_enabled = 1 if data.alerts_enabled else 0
    if data.onboarding_completed is not None:
        user.onboarding_completed = 1 if data.onboarding_completed else 0
        
    db.commit()
    db.refresh(user)
    
    # Parse crops list from text
    crops_list = []
    if user.crops:
        try:
            crops_list = json.loads(user.crops)
        except Exception:
            crops_list = [c.strip() for c in user.crops.split(",") if c.strip()]

    return ProfileResponse(
        username=user.username,
        display_name=user.display_name,
        language=user.language,
        state=user.state,
        district=user.district,
        mandal=user.mandal,
        crops=crops_list,
        alerts_enabled=user.alerts_enabled == 1,
        onboarding_completed=user.onboarding_completed == 1
    )
