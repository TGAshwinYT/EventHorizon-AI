from fastapi import APIRouter, Request, HTTPException, Form, File, UploadFile, Depends, Header
from fastapi.responses import JSONResponse
import base64
import os
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel
from app.services.gemini_service import GeminiService
from app.services.audio_service import AudioService
from app.database import get_auth_db, AuthSessionLocal
from app.models import User, ChatHistory
from app.auth import decode_access_token
from sqlalchemy.orm import Session
from app.llm_memory_manager import process_and_trim_history

# Initialize services
gemini_service = GeminiService()
audio_service = AudioService()

router = APIRouter()

def detect_language(text: str, default: str = 'en') -> str:
    """Simple script-based language detection for Indian languages"""
    if any('\u0900' <= c <= '\u097F' for c in text): return 'hi'  # Hindi
    elif any('\u0C00' <= c <= '\u0C7F' for c in text): return 'te'  # Telugu
    elif any('\u0980' <= c <= '\u09FF' for c in text): return 'bn'  # Bengali
    elif any('\u0800' <= c <= '\u0BFF' for c in text): return 'ta'  # Tamil
    elif any('\u0C80' <= c <= '\u0CFF' for c in text): return 'kn'  # Kannada
    elif any('\u0D00' <= c <= '\u0D7F' for c in text): return 'ml'  # Malayalam
    elif any('\u0A80' <= c <= '\u0AFF' for c in text): return 'gu'  # Gujarati
    return default

def get_user_db():
    db = AuthSessionLocal()
    try:
        yield db
    finally:
        db.close()

class TTSRequest(BaseModel):
    text: str
    language: str = 'en'

class EnvUpdate(BaseModel):
    GEMINI_API_KEY: Optional[str] = None
    HUGGINGFACE_API_KEY: Optional[str] = None

class GenerateContentRequest(BaseModel):
    topic: str
    type: str
    language: str = 'en'

@router.post('')
async def chat_endpoint(request: Request):
    """
    Main chat endpoint supporting both text and voice input.
    Pipeline: Audio -> STT -> Translate -> Gemini -> Translate -> TTS
    """
    # Handle both JSON (from frontend text) and Multipart (potentially for audio)
    content_type = request.headers.get('content-type', '')
    
    message = None
    language = 'en'
    voice_enabled = False
    context = 'general'
    audio: Optional[UploadFile] = None
    
    if 'application/json' in content_type:
        data = await request.json()
        message = data.get('message')
        language = data.get('language', 'en')
        voice_enabled = data.get('voice_enabled', False)
        context = data.get('context', 'general')
    elif 'multipart/form-data' in content_type:
        form = await request.form()
        message = form.get('message')
        language = form.get('language', 'en')
        voice_enabled_str = form.get('voice_enabled')
        voice_enabled = voice_enabled_str == 'true' or voice_enabled_str == True
        context = form.get('context', 'general')
        audio = form.get('audio') # This will be UploadFile or None
    else:
        # Fallback handling mostly for robustness
        raise HTTPException(status_code=400, detail="Unsupported Content-Type")

    # Auth Check: Get User ID
    user_id = None
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith("Bearer "):
        try:
            token = auth_header.split(" ")[1]
            payload = decode_access_token(token)
            if payload:
                username = payload.get("sub")
                db = AuthSessionLocal()
                user = db.query(User).filter(User.username == username).first()
                if user:
                    user_id = user.id
                db.close()
        except Exception as e:
            print(f"[AUTH ERROR] {e}")

    # Retrieve memory mapped from DB history for this user
    session_db_history = []
    if user_id:
        db = AuthSessionLocal()
        raw_history = db.query(ChatHistory).filter(ChatHistory.user_id == user_id).order_by(ChatHistory.timestamp).all()
        for h in raw_history:
            session_db_history.append({
                "role": 'assistant' if h.sender == 'ai' else h.sender,
                "content": h.message
            })
        db.close()

    user_message = message
    
    # Language Mapping
    LANGUAGE_NAMES = {
        'en': 'English',
        'hi': 'Hindi',
        'bn': 'Bengali',
        'te': 'Telugu',
        'mr': 'Marathi',
        'ta': 'Tamil',
        'gu': 'Gujarati',
        'kn': 'Kannada',
        'ml': 'Malayalam'
    }

    # Step 2: Determine Output Language (EARLY)
    if language:
        target_lang = language
    else:
        target_lang = 'en'
        
    target_lang_name = LANGUAGE_NAMES.get(target_lang, 'English')
    
    use_search_flag = False

    # Market Labels Localization
    MARKET_LABELS = {
        'en': {'today': "Today's Rate", 'yesterday': "Yesterday's Rate", 'trend': "Trend"},
        'hi': {'today': "आज का भाव", 'yesterday': "कल का भाव", 'trend': "बाज़ार का रुझान"},
        'ta': {'today': "இன்றைய விலை", 'yesterday': "நேற்றைய விலை", 'trend': "சந்தை போக்கு"},
        'te': {'today': "ఈరోజు ధర", 'yesterday': "నిన్నటి ధర", 'trend': "ధరల సరళి"},
        'kn': {'today': "ಇಂದಿನ ದರ", 'yesterday': "ನಿನ್ನೆಯ ದರ", 'trend': "ದರ ಏರಿಳಿತ"},
        'ml': {'today': "ഇന്നത്തെ വില", 'yesterday': "ഇന്നലത്തെ വില", 'trend': "വിപണി പ്രവണത"},
        'bn': {'today': "আজকের দর", 'yesterday': "গতকালের দর", 'trend': "বাজারের প্রবণতা"},
        'mr': {'today': "आजचा भाव", 'yesterday': "कालचा भाव", 'trend': "बाजार भाव"},
        'gu': {'today': "આજના ભાવ", 'yesterday': "ગઈકાલના ભાવ", 'trend': "બજાર વલણ"}
    }
    
    # Instruction for structured response (Summary + Details)
    # Check if request has 'type' == 'market'
    # Since we manually parsed, we need to check data/form again
    type_val = None
    if 'application/json' in content_type:
        data = await request.json()
        type_val = data.get('type')
    
    if type_val == 'market':
        use_search_flag = True
        
        # Get localized labels
        labels = MARKET_LABELS.get(target_lang, MARKET_LABELS['en'])
        
        structured_instruction = (
            f" Provide the answer IN {target_lang_name.upper()}. "
            "IMPORTANT: Use the Google Search tool to find the LATEST real-time market rates for the requested crop in India. "
            "Format the response EXACTLY as follows, with NO bolding (*), NO markdown, and NO extra text:\n"
            f"{labels['today']}: [Real rate found via search]\n"
            f"{labels['yesterday']}: [Real rate found via search or estimate]\n"
            f"{labels['trend']}: [Brief explanation based on search results]\n"
            "||| [Leave this part Key strictly empty as user will click more details for info]"
        )
    else:
        structured_instruction = (
            f" Provide the answer IN {target_lang_name.upper()} in two parts using a strict delimiter '|||'. "
            "Part 1: A concise 3-line summary. "
            "Part 2: Detailed explanation and more information if applicable. "
            "Structure: [Summary] ||| [Details]"
        )

    # Step 1: Logic Branch for Audio vs Text
    ai_response = ""
    
    if audio:
        audio_bytes = await audio.read()
        # Create a new user message asking to transcribe and answer
        extended_instruction = structured_instruction + "\nTASK: 1. Transcribe the user's speech exactly (in original language).\n2. Provide a helpful response to the query.\n3. FOLLOW ADDITIONAL INSTRUCTIONS IF ANY.\n\nOUTPUT FORMAT:\nTranscribed: <user_speech>\nResponse: <ai_response>"
        
        trimmed_history = process_and_trim_history(session_db_history, extended_instruction, max_conversational_items=6)
        
        gemini_output = gemini_service.generate_response(message="", audio_data=audio_bytes, audio_mime_type='audio/ogg', context=context, use_search=use_search_flag, history=trimmed_history)
        print(f"[GEMINI AUDIO] Raw output: {gemini_output[:100]}...")
        
        # Parse Output
        import re
        transcribed_match = re.search(r"Transcribed:\s*(.*?)(?:\nResponse:|$)", gemini_output, re.DOTALL)
        response_match = re.search(r"Response:\s*(.*)", gemini_output, re.DOTALL)
        
        if transcribed_match:
            user_message = transcribed_match.group(1).strip()
        else:
            user_message = "(Audio Input)"
            
        if response_match:
            ai_response = response_match.group(1).strip()
        else:
            # Fallback if format failed
            ai_response = gemini_output.replace(f"Transcribed: {user_message}", "").strip()

        print(f"[GEMINI AUDIO] Transcribed: {user_message}")
        print(f"[GEMINI AUDIO] Response: {ai_response}")
        
    elif user_message:
        # Text Flow
        if not language or language == 'en':
             detected_lang = detect_language(user_message, 'en')
        else:
             detected_lang = detect_language(user_message, language)
        
        if detected_lang != 'en':
            english_query = audio_service.translate_text(user_message, 'en')
            print(f"[TRANSLATE] {detected_lang}->en: {english_query}")
        else:
            english_query = user_message
            
        final_query = english_query + "\n\n" + structured_instruction
        trimmed_history = process_and_trim_history(session_db_history, final_query, max_conversational_items=6)
        
        ai_response = gemini_service.generate_response(message="", context=context, use_search=use_search_flag, history=trimmed_history)
        print(f"[GEMINI TEXT] {ai_response[:100]}...")
        
    else:
        raise HTTPException(status_code=400, detail="No message or audio provided")

    # Step 3: Translation Skipped (Gemini handles it via instruction)
    final_response = ai_response
    
    # Update detected_lang for frontend sync
    if 'detected_lang' not in locals():
        detected_lang = target_lang
    
    # Step 6: Generate speech if voice enabled
    audio_url = None
    if voice_enabled:
        # Clean text for TTS (remove markdown * # - etc)
        import re
        clean_text = re.sub(r'[*#_`~-]', '', final_response)
        audio_bytes = audio_service.text_to_speech(clean_text, detected_lang)
        if audio_bytes:
            audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
            audio_url = f"data:audio/mp3;base64,{audio_base64}"
            print(f"[TTS] Generated audio ({len(audio_bytes)} bytes)")
    
    # Save to DB
    if user_id:
        try:
            db = AuthSessionLocal()
            db.add(ChatHistory(user_id=user_id, message=user_message, sender="user"))
            db.add(ChatHistory(user_id=user_id, message=final_response, sender="ai"))
            db.commit()
            db.close()
        except Exception as e:
            print(f"[DB ERROR] Could not save chat history: {e}")
    
    return {
        "response_text": final_response,
        "user_text": user_message,
        "audio_url": audio_url,
        "detected_language": detected_lang
    }

@router.get('/history')
def get_chat_history(authorization: str = Header(None)):
    print(f"[CHAT DEBUG] Auth Header: {authorization[:20] if authorization else 'None'}...")
    if not authorization or not authorization.startswith("Bearer "):
        print("[CHAT DEBUG] Missing or invalid Authorization header")
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    try:
        token = authorization.split(" ")[1]
        payload = decode_access_token(token)
        if not payload:
            print("[CHAT DEBUG] Token decode failed (payload is None)")
            raise HTTPException(status_code=401, detail="Invalid token")
            
        username = payload.get("sub")
        db = AuthSessionLocal()
        user = db.query(User).filter(User.username == username).first()
        
        if not user:
            db.close()
            raise HTTPException(status_code=404, detail="User not found")
            
        history = db.query(ChatHistory).filter(ChatHistory.user_id == user.id).order_by(ChatHistory.timestamp).all()
        
        messages = []
        for msg in history:
            messages.append({
                "id": str(msg.id),
                "text": msg.message,
                "sender": msg.sender,
                "timestamp": msg.timestamp.isoformat()
            })
            
        db.close()
        return messages
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[HISTORY ERROR] {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch history")

@router.delete('/history')
def delete_all_history(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    try:
        token = authorization.split(" ")[1]
        payload = decode_access_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
            
        username = payload.get("sub")
        db = AuthSessionLocal()
        user = db.query(User).filter(User.username == username).first()
        
        if not user:
            db.close()
            raise HTTPException(status_code=404, detail="User not found")
            
        # Delete all history for this user
        db.query(ChatHistory).filter(ChatHistory.user_id == user.id).delete()
        db.commit()
        db.close()
        return {"message": "History deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[HISTORY DELETE ERROR] {e}")
        raise HTTPException(status_code=500, detail="Failed to delete history")

@router.delete('/history/{msg_id}')
def delete_message(msg_id: int, authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    try:
        token = authorization.split(" ")[1]
        payload = decode_access_token(token)
        if not payload:
             raise HTTPException(status_code=401, detail="Invalid token")
            
        username = payload.get("sub")
        db = AuthSessionLocal()
        user = db.query(User).filter(User.username == username).first()
        
        if not user:
            db.close()
            raise HTTPException(status_code=404, detail="User not found")
            
        # Delete specific message
        msg = db.query(ChatHistory).filter(ChatHistory.id == msg_id, ChatHistory.user_id == user.id).first()
        if msg:
            db.delete(msg)
            db.commit()
        
        db.close()
        return {"message": "Message deleted"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[MESSAGE DELETE ERROR] {e}")
        raise HTTPException(status_code=500, detail="Failed to delete message")

@router.post('/tts')
def generate_tts(data: TTSRequest):
    """
    Generate TTS audio for a given text.
    """
    text = data.text
    language = data.language
    
    # Clean text for TTS
    import re
    clean_text = re.sub(r'[*#_`~-]', '', text)
    
    try:
        audio_bytes = audio_service.text_to_speech(clean_text, language)
        if audio_bytes:
            audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
            audio_url = f"data:audio/mp3;base64,{audio_base64}"
            return {"audio_url": audio_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS Failure: {str(e)}")
    
    raise HTTPException(status_code=500, detail="Failed to generate audio (Unknown)")

@router.post('/settings/env')
def update_env_settings(data: EnvUpdate):
    """
    Update .env file with provided settings.
    """
    gemini_key = data.GEMINI_API_KEY
    hf_key = data.HUGGINGFACE_API_KEY
    
    if not gemini_key and not hf_key:
        return {"message": "No keys provided to update"}
        
    env_path = '.env'
    
    # Read existing env
    env_lines = []
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            env_lines = f.readlines()
            
    new_lines = []
    keys_updated = set()
    
    for line in env_lines:
        if line.startswith('GEMINI_API_KEY=') and gemini_key:
            new_lines.append(f'GEMINI_API_KEY={gemini_key}\n')
            keys_updated.add('GEMINI_API_KEY')
        elif line.startswith('HUGGINGFACE_API_KEY=') and hf_key:
            new_lines.append(f'HUGGINGFACE_API_KEY={hf_key}\n')
            keys_updated.add('HUGGINGFACE_API_KEY')
        else:
            new_lines.append(line)
            
    if gemini_key and 'GEMINI_API_KEY' not in keys_updated:
        if new_lines and not new_lines[-1].endswith('\n'):
            new_lines.append('\n')
        new_lines.append(f'GEMINI_API_KEY={gemini_key}\n')
        
    if hf_key and 'HUGGINGFACE_API_KEY' not in keys_updated:
        if new_lines and not new_lines[-1].endswith('\n'):
            new_lines.append('\n')
        new_lines.append(f'HUGGINGFACE_API_KEY={hf_key}\n')
        
    try:
        with open(env_path, 'w') as f:
            f.writelines(new_lines)
        
        # Reload env in current process
        from dotenv import load_dotenv
        load_dotenv(override=True)
            
        return {"message": "Settings updated successfully"}
    except Exception as e:
        print(f"[ENV UPDATE ERROR] {e}")
        raise HTTPException(status_code=500, detail="Failed to update settings")

@router.post('/generate')
def generate_content(data: GenerateContentRequest):
    """
    Generic endpoint to generate structured content via Gemini.
    Used for Marketing blogs, Schemes, Vehicle details, etc.
    """
    topic = data.topic
    type_ = data.type
    language = data.language
        
    prompt = ""
    if type_ == 'marketing':
        prompt = f"Generate 3 real-world success stories about {topic} in India. Format as JSON with fields: name, location, content (summary of success), image_prompt (description for image generation). Language: {language}."
    elif type_ == 'schemes':
        prompt = f"List 3 real government schemes for {topic} in India. Format as JSON with fields: name, details, eligibility, application_link (real or placeholder), youtube_link (real or placeholder). Language: {language}."
    elif type_ == 'vehicles':
         prompt = f"List 3 popular agricultural vehicles for {topic} in India with real-time approximate prices. Format as JSON with fields: name, type, price, purpose, image_prompt. Language: {language}."
    
    # helper to get json from gemini
    try:
        response = gemini_service.generate_response(prompt, context='general')
        # Clean markdown json
        import re
        import json
        json_match = re.search(r'\{.*\}|\[.*\]', response, re.DOTALL)
        if json_match:
            return json.loads(json_match.group(0))
        else:
            raise HTTPException(status_code=500, detail={"error": "Failed to parse generation", "raw": response})
    except Exception as e:
        print(f"[GENERATE ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))
