from fastapi import APIRouter, Request, HTTPException, Form, File, UploadFile, Depends, Header
from fastapi.responses import JSONResponse
import base64
import os
import io
import tempfile
from groq import Groq
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel
from app.services.gemini_service import gemini_service
from app.services.riva_tts_service import riva_tts_service
from app.database import get_auth_db, AuthSessionLocal
from app.models import User, ChatHistory
from app.auth import decode_access_token
from sqlalchemy.orm import Session
from app.llm_memory_manager import process_and_trim_history

router = APIRouter()

def get_local_whisper_model():
    """Retrieve the pre-loaded local Whisper tiny model from global RAM context in O(1) time."""
    from app.main import ml_models
    return ml_models.get("whisper_tiny")

async def transcribe_audio_with_fallback(audio: UploadFile) -> tuple[str, str]:
    """
    Transcribe audio with graceful degradation.
    Returns: (transcribed_text, detected_language_code)
    """
    audio_bytes = await audio.read()
    from app.services.riva_asr_service import riva_asr_service
    return await riva_asr_service.transcribe(audio_bytes)

def detect_language(text: str, default: str = 'en') -> str:
    """Simple script-based language detection for Indian languages"""
    if any('\u0900' <= c <= '\u097F' for c in text): return 'hi'  # Hindi
    elif any('\u0C00' <= c <= '\u0C7F' for c in text): return 'te'  # Telugu
    elif any('\u0980' <= c <= '\u09FF' for c in text): return 'bn'  # Bengali
    elif any('\u0B80' <= c <= '\u0BFF' for c in text): return 'ta'  # Tamil
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
    
    # Check if request has 'type' == 'market'
    type_val = None
    if 'application/json' in content_type:
        data = await request.json()
        type_val = data.get('type')
    
    use_search_flag = (type_val == 'market')

    # Step 1: Logic Branch for Audio vs Text
    ai_response = ""
    
    if audio:
        audio_bytes = await audio.read()
        from app.services.riva_asr_service import riva_asr_service
        
        # 1. Transcribe audio using Groq Whisper (which handles Taenglish/Hienglish)
        transcribed_text, detected_lang = await riva_asr_service.transcribe(audio_bytes)
        
        print(f"[ASR] User said: {transcribed_text}")
        if not transcribed_text:
            raise HTTPException(status_code=400, detail="Could not understand audio")
            
        user_message = transcribed_text
        
        # Determine instruction
        market_instruction = ""
        if use_search_flag:
            labels = MARKET_LABELS.get(target_lang, MARKET_LABELS['en'])
            market_instruction = (
                "IMPORTANT: Use the Google Search tool to find the LATEST real-time market rates for the requested crop in India. "
                "Format the response EXACTLY as follows, with NO markdown:\n"
                f"{labels['today']}: [Rate]\n"
                f"{labels['yesterday']}: [Rate]\n"
                f"{labels['trend']}: [Trend]\n"
                "||| "
            )
        else:
            market_instruction = (
                "Provide the answer in two parts using a strict delimiter '|||'. "
                "Part 1: A concise 3-line summary. Part 2: Detailed explanation. "
                "Structure: [Summary] ||| [Details]"
            )

        extended_instruction = market_instruction + f"\nTASK: Provide a helpful response IN {target_lang_name.upper()}. If the user uses a code-mixed language or roman script, match their style but respond natively in {target_lang_name}."
        
        trimmed_history = process_and_trim_history(session_db_history, extended_instruction, max_conversational_items=6)
        
        # 2. Pass transcribed text to Gemini
        ai_response = gemini_service.generate_response(message=user_message, context=context, detected_language=detected_lang, use_search=use_search_flag, history=trimmed_history)
        print(f"[GEMINI] Response: {ai_response}")
        
        # Use the language explicitly selected in the UI for TTS and AI response
        detected_lang = target_lang
        
    elif user_message:
        # Text Flow - use the language explicitly selected in the UI
        detected_lang = target_lang
        detected_lang_name = LANGUAGE_NAMES.get(detected_lang, 'English')
        
        final_query_text = user_message
            
        # Structure the instruction with the DETECTED language, not the UI language
        if use_search_flag:
            labels = MARKET_LABELS.get(target_lang, MARKET_LABELS['en'])
            structured_instruction = (
                f" Provide the answer IN {detected_lang_name.upper()}. "
                "IMPORTANT: Use the Google Search tool to find the LATEST real-time market rates for the requested crop in India. "
                "Format the response EXACTLY as follows, with NO bolding (*), NO markdown, and NO extra text:\n"
                f"{labels['today']}: [Real rate found via search]\n"
                f"{labels['yesterday']}: [Real rate found via search or estimate]\n"
                f"{labels['trend']}: [Brief explanation based on search results]\n"
                "||| [Leave this part Key strictly empty as user will click more details for info]"
            )
        else:
            structured_instruction = (
                f" Provide the answer IN {detected_lang_name.upper()} in two parts using a strict delimiter '|||'. "
                "Part 1: A concise 3-line summary. "
                "Part 2: Detailed explanation and more information if applicable. "
                "Structure: [Summary] ||| [Details]"
            )

        if detected_lang == 'ta':
            structured_instruction += " IMPORTANT: Respond in natural, conversational 'Taenglish' (Tamil written in Roman/English script or a mix, matching the user's script style). Do not sound like a formal machine translation. Speak like a helpful friend."
        elif detected_lang != 'en':
            structured_instruction += f" IMPORTANT: Respond in natural, conversational {detected_lang_name}. Do not sound like a formal machine translation."
            
        final_query = final_query_text + "\n\n" + structured_instruction
        trimmed_history = process_and_trim_history(session_db_history, final_query, max_conversational_items=6)
        
        ai_response = gemini_service.generate_response(message="", context=context, detected_language=detected_lang, use_search=use_search_flag, history=trimmed_history)
        print(f"[GEMINI TEXT] {ai_response[:100]}...")
        
    else:
        raise HTTPException(status_code=400, detail="No message or audio provided")

    # Step 3: Translation Skipped (Gemini handles it via instruction)
    final_response = ai_response
    
    # Step 6: Generate speech if voice enabled
    audio_url = None
    if voice_enabled:
        # Clean text for TTS (remove markdown * # - etc)
        import re
        clean_text = re.sub(r'[*#_`~-]', '', final_response)
        audio_bytes = await riva_tts_service.synthesize(clean_text, detected_lang)
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

from fastapi.responses import StreamingResponse
import asyncio
import json

@router.post('/stream')
async def chat_stream_endpoint(request: Request):
    """
    Streaming chat endpoint for SSE.
    Streams text chunks instantly, and yields audio chunks as soon as sentences complete.
    """
    content_type = request.headers.get('content-type', '')
    
    message = None
    language = 'en'
    context = 'general'
    audio: Optional[UploadFile] = None
    
    if 'multipart/form-data' in content_type:
        form = await request.form()
        message = form.get('message')
        language = form.get('language', 'en')
        context = form.get('context', 'general')
        page_context = form.get('page_context', '')
        audio = form.get('audio')
    else:
        raise HTTPException(status_code=400, detail="Unsupported Content-Type")

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
            pass

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
    target_lang = language or 'en'
    
    # 1. Handle Audio
    if audio:
        audio_bytes = await audio.read()
        from app.services.riva_asr_service import riva_asr_service
        transcribed_text, detected_lang = await riva_asr_service.transcribe(audio_bytes)
        if not transcribed_text:
            raise HTTPException(status_code=400, detail="Could not understand audio")
        user_message = transcribed_text
        target_lang = detected_lang
    elif user_message:
        detected_lang = target_lang
    else:
         raise HTTPException(status_code=400, detail="No message or audio provided")

    LANGUAGE_NAMES = {
        'en': 'English', 'hi': 'Hindi', 'bn': 'Bengali', 'te': 'Telugu',
        'mr': 'Marathi', 'ta': 'Tamil', 'gu': 'Gujarati', 'kn': 'Kannada', 'ml': 'Malayalam'
    }
    target_lang_name = LANGUAGE_NAMES.get(target_lang, 'English')

    # Construct Prompt
    instruction = ""
    if page_context:
        instruction += f"The user is currently viewing the {page_context} page. "
    
    instruction += (
        "Provide a concise summary first. "
        f"IMPORTANT TASK: Provide a helpful response IN {target_lang_name.upper()}. "
        f"If the user uses a code-mixed language or roman script, match their style but respond natively in {target_lang_name}."
    )
    final_query = (user_message or "") + "\n\n" + instruction
    trimmed_history = process_and_trim_history(session_db_history, final_query, max_conversational_items=6)

    # Save User Message
    if user_id and user_message:
        try:
            db = AuthSessionLocal()
            db.add(ChatHistory(user_id=user_id, message=user_message, sender="user"))
            db.commit()
            db.close()
        except Exception:
            pass

    async def event_stream():
        # First send the transcribed text to UI so user can see it immediately
        yield f"data: {json.dumps({'type': 'metadata', 'user_text': user_message, 'detected_language': detected_lang})}\n\n"
        
        full_response = ""
        sentence_buffer = ""
        
        # We define sentence boundaries to trigger TTS chunks
        import re
        # matches punctuation followed by space or end of string
        sentence_end_pattern = re.compile(r'([.?!।]\s+)|([.?!।]$)')
        
        from app.services.riva_tts_service import riva_tts_service

        async for chunk in gemini_service.generate_response_stream(message="", context=context, detected_language=detected_lang, history=trimmed_history):
            full_response += chunk
            sentence_buffer += chunk
            
            # Send text chunk immediately
            yield f"data: {json.dumps({'type': 'text', 'text': chunk})}\n\n"
            
            # Check if sentence buffer has a complete sentence
            match = sentence_end_pattern.search(sentence_buffer)
            if match:
                end_idx = match.end()
                sentence_to_speak = sentence_buffer[:end_idx].strip()
                sentence_buffer = sentence_buffer[end_idx:]
                
                # Clean up markdown
                clean_sentence = re.sub(r'[*#_`~-]', '', sentence_to_speak).strip()
                if len(clean_sentence) > 2:
                    # Synthesize this sentence asynchronously
                    audio_bytes = await riva_tts_service.synthesize(clean_sentence, detected_lang)
                    if audio_bytes:
                        audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
                        yield f"data: {json.dumps({'type': 'audio', 'audio_base64': audio_base64})}\n\n"

        # After the loop, speak whatever is left in the buffer
        if sentence_buffer.strip():
            clean_sentence = re.sub(r'[*#_`~-]', '', sentence_buffer).strip()
            if len(clean_sentence) > 2:
                audio_bytes = await riva_tts_service.synthesize(clean_sentence, detected_lang)
                if audio_bytes:
                    audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
                    yield f"data: {json.dumps({'type': 'audio', 'audio_base64': audio_base64})}\n\n"
                    
        # Send complete marker
        yield f"data: {json.dumps({'type': 'complete'})}\n\n"
        
        # Save AI Response
        if user_id and full_response:
            try:
                db = AuthSessionLocal()
                db.add(ChatHistory(user_id=user_id, message=full_response, sender="ai"))
                db.commit()
                db.close()
            except Exception:
                pass

    return StreamingResponse(event_stream(), media_type="text/event-stream")

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
async def generate_tts(data: TTSRequest):
    """
    Generate TTS audio for a given text.
    """
    text = data.text
    
    # Auto-detect language of the text to prevent TTS language mismatch
    # (e.g. reading Tamil text with an English voice)
    language = detect_language(text, default=data.language)
    
    # Clean text for TTS
    import re
    clean_text = re.sub(r'[*#_`~-]', '', text)
    
    try:
        audio_bytes = await riva_tts_service.synthesize(clean_text, language)
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

@router.post('/voice')
async def voice_chat_endpoint(
    audio: UploadFile = File(...)
):
    """
    Multilingual voice endpoint using Groq Whisper -> Gemini 1.5 Flash -> Edge-TTS
    with graceful degradation to local Whisper.
    """
    try:
        # 1. & 2. Receive Audio and Speech-to-Text with Fallback
        user_text, detected_language = await transcribe_audio_with_fallback(audio)
        
        if not user_text:
             raise HTTPException(status_code=422, detail="Transcription resulted in empty text.")
             
        # 3. LLM Processing via Gemini
        # We instruct Gemini to respond in the detected language.
        context = "general"
        system_prompt = f"Respond to the user's query exactly in the same language they used. The detected language code is '{detected_language}'."
        
        gemini_response = gemini_service.generate_response(
            message=user_text,
            context=context,
            detected_language=detected_language
        )
        
        # 4. Text-to-Speech via Edge-TTS
        audio_url = None
        # Clean text
        import re
        clean_text = re.sub(r'[*#_`~-]', '', gemini_response)
        
        # Map Whisper language codes to Edge-TTS if needed (audio_service uses 2-letter codes)
        tts_audio_bytes = await riva_tts_service.synthesize(clean_text, detected_language)
        
        if tts_audio_bytes:
            audio_base64 = base64.b64encode(tts_audio_bytes).decode('utf-8')
            audio_url = f"data:audio/mp3;base64,{audio_base64}"
            
        # 5. Return JSON
        return {
            "response_text": gemini_response,
            "user_text": user_text,
            "detected_language": detected_language,
            "audio_url": audio_url
        }
        
    except Exception as e:
        print(f"[VOICE ENDPOINT ERROR] {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

