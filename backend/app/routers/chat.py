from fastapi import APIRouter, Request, HTTPException, Form, File, UploadFile, Depends, Header
from fastapi.responses import JSONResponse
import base64
import os
import io
import tempfile
import re
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

# Language code → full name map (used for instruction building)
LANGUAGE_NAMES = {
    'en': 'English', 'hi': 'Hindi', 'bn': 'Bengali', 'te': 'Telugu',
    'mr': 'Marathi', 'ta': 'Tamil', 'gu': 'Gujarati', 'kn': 'Kannada',
    'ml': 'Malayalam', 'pa': 'Punjabi'
}

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


def detect_language_from_script(text: str, default: str = 'en') -> str:
    """Quick Unicode script-based language detection."""
    if any('\u0900' <= c <= '\u097F' for c in text): return 'hi'
    elif any('\u0C00' <= c <= '\u0C7F' for c in text): return 'te'
    elif any('\u0980' <= c <= '\u09FF' for c in text): return 'bn'
    elif any('\u0B80' <= c <= '\u0BFF' for c in text): return 'ta'
    elif any('\u0C80' <= c <= '\u0CFF' for c in text): return 'kn'
    elif any('\u0D00' <= c <= '\u0D7F' for c in text): return 'ml'
    elif any('\u0A80' <= c <= '\u0AFF' for c in text): return 'gu'
    elif any('\u0A00' <= c <= '\u0A7F' for c in text): return 'pa'
    return default


def get_current_user_id(request: Request) -> Optional[int]:
    """Extract and validate user ID from Bearer token."""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    try:
        token = auth_header.split(" ")[1]
        payload = decode_access_token(token)
        if not payload:
            return None
        username = payload.get("sub")
        db = AuthSessionLocal()
        user = db.query(User).filter(User.username == username).first()
        user_id = user.id if user else None
        db.close()
        return user_id
    except Exception as e:
        print(f"[AUTH ERROR] {e}")
        return None


def load_user_history(user_id: int) -> List[Dict[str, str]]:
    """Load chat history from DB for a user."""
    db = AuthSessionLocal()
    raw = db.query(ChatHistory).filter(
        ChatHistory.user_id == user_id
    ).order_by(ChatHistory.timestamp).all()
    history = []
    for h in raw:
        history.append({
            "role": 'assistant' if h.sender == 'ai' else h.sender,
            "content": h.message
        })
    db.close()
    return history


def save_chat_history(user_id: int, user_message: str, ai_response: str):
    """Save a conversation turn to DB."""
    try:
        db = AuthSessionLocal()
        db.add(ChatHistory(user_id=user_id, message=user_message, sender="user"))
        db.add(ChatHistory(user_id=user_id, message=ai_response, sender="ai"))
        db.commit()
        db.close()
    except Exception as e:
        print(f"[DB ERROR] Could not save chat history: {e}")


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

    KEY FIX: detected_lang from Groq Whisper is NO LONGER overwritten
    by the UI's target_lang. The language flows correctly:
      Voice → Groq Whisper detects lang → Gemini replies in that lang → TTS speaks in that lang
    """
    content_type = request.headers.get('content-type', '')

    message = None
    language = 'en'        # UI-selected language (used for TEXT mode only)
    voice_enabled = False
    context = 'general'
    use_search_flag = False
    audio: Optional[UploadFile] = None

    if 'application/json' in content_type:
        data = await request.json()
        message = data.get('message')
        language = data.get('language', 'en')
        voice_enabled = data.get('voice_enabled', False)
        context = data.get('context', 'general')
        use_search_flag = data.get('type') == 'market'
    elif 'multipart/form-data' in content_type:
        form = await request.form()
        message = form.get('message')
        language = form.get('language', 'en')
        voice_enabled_str = form.get('voice_enabled')
        voice_enabled = voice_enabled_str in ('true', True)
        context = form.get('context', 'general')
        audio = form.get('audio')
    else:
        raise HTTPException(status_code=400, detail="Unsupported Content-Type")

    # Auth
    user_id = get_current_user_id(request)

    # Load history
    session_db_history = load_user_history(user_id) if user_id else []

    # ──────────────────────────────────────────────────────────
    # VOICE FLOW
    # ──────────────────────────────────────────────────────────
    if audio:
        audio_bytes = await audio.read()
        from app.services.riva_asr_service import riva_asr_service

        # Step 1: Transcribe — auto-detect language from voice
        transcribed_text, detected_lang = await riva_asr_service.transcribe(audio_bytes)
        print(f"[ASR] Heard: '{transcribed_text}' | Lang: {detected_lang}")

        if not transcribed_text:
            raise HTTPException(status_code=400, detail="Could not understand audio")

        user_message = transcribed_text

        # ✅ KEY FIX: Do NOT overwrite detected_lang with target_lang here!
        # detected_lang from Groq is the correct language to use for Gemini + TTS

        # Build instruction for Gemini
        lang_name = LANGUAGE_NAMES.get(detected_lang, 'English')
        if use_search_flag:
            labels = MARKET_LABELS.get(detected_lang, MARKET_LABELS['en'])
            instruction = (
                f"IMPORTANT: Use the Google Search tool to find the LATEST real-time market rates in India. "
                f"Format the response EXACTLY as follows, NO markdown:\n"
                f"{labels['today']}: [Rate]\n"
                f"{labels['yesterday']}: [Rate]\n"
                f"{labels['trend']}: [Trend]\n||| "
            )
        else:
            instruction = (
                f"Provide the answer in two parts using a strict delimiter '|||'. "
                f"Part 1: A concise 3-line summary. Part 2: Detailed explanation. "
                f"Structure: [Summary] ||| [Details]"
            )

        final_query = f"{transcribed_text}\n\n{instruction}"
        trimmed_history = process_and_trim_history(session_db_history, final_query, max_conversational_items=6)

        # Step 2: Generate AI response — pass detected_lang so Gemini replies correctly
        ai_response = gemini_service.generate_response(
            message=transcribed_text,
            context=context,
            detected_language=detected_lang,   # ✅ Correct language flows here
            use_search=use_search_flag,
            history=trimmed_history
        )
        print(f"[GEMINI] Response: {ai_response[:100]}...")

    # ──────────────────────────────────────────────────────────
    # TEXT FLOW
    # ──────────────────────────────────────────────────────────
    elif message:
        user_message = message

        # For text: use UI-selected language, but verify against actual text content
        detected_lang = detect_language_from_script(message, default=language)

        lang_name = LANGUAGE_NAMES.get(detected_lang, 'English')

        if use_search_flag:
            labels = MARKET_LABELS.get(detected_lang, MARKET_LABELS['en'])
            instruction = (
                f"Provide the answer IN {lang_name.upper()}. "
                "IMPORTANT: Use the Google Search tool to find the LATEST real-time market rates for the requested crop in India. "
                f"Format EXACTLY:\n{labels['today']}: [Rate]\n{labels['yesterday']}: [Rate]\n{labels['trend']}: [Trend]\n"
                "||| [Leave empty]"
            )
        else:
            instruction = (
                f"Provide the answer IN {lang_name.upper()} in two parts using '|||' delimiter. "
                "Part 1: A concise 3-line summary. Part 2: Detailed explanation. "
                "Structure: [Summary] ||| [Details]"
            )

        final_query = f"{message}\n\n{instruction}"
        trimmed_history = process_and_trim_history(session_db_history, final_query, max_conversational_items=6)

        ai_response = gemini_service.generate_response(
            message="",
            context=context,
            detected_language=detected_lang,   # ✅ Correct language
            use_search=use_search_flag,
            history=trimmed_history
        )
        print(f"[GEMINI TEXT] {ai_response[:100]}...")

    else:
        raise HTTPException(status_code=400, detail="No message or audio provided")

    # ──────────────────────────────────────────────────────────
    # TTS (if voice enabled)
    # ──────────────────────────────────────────────────────────
    audio_url = None
    if voice_enabled:
        clean_text = re.sub(r'[*#_`~-]', '', ai_response)
        # Remove the ||| delimiter — only speak the summary part
        speak_text = clean_text.split('|||')[0].strip()
        audio_bytes_out = await riva_tts_service.synthesize(speak_text, detected_lang)
        if audio_bytes_out:
            audio_base64 = base64.b64encode(audio_bytes_out).decode('utf-8')
            mime = "audio/wav" if audio_bytes_out.startswith(b"RIFF") else "audio/mp3"
            audio_url = f"data:{mime};base64,{audio_base64}"
            print(f"[TTS] Generated audio ({len(audio_bytes_out)} bytes) in lang={detected_lang}")

    # Save to DB
    if user_id:
        save_chat_history(user_id, user_message, ai_response)

    return {
        "response_text": ai_response,
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
    KEY FIX: detected_lang from voice is preserved all the way to TTS.
    """
    content_type = request.headers.get('content-type', '')

    message = None
    language = 'en'
    context = 'general'
    page_context = ''
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

    user_id = get_current_user_id(request)
    session_db_history = load_user_history(user_id) if user_id else []

    user_message = message
    detected_lang = language  # default for text mode

    # Handle audio
    if audio:
        audio_bytes = await audio.read()
        from app.services.riva_asr_service import riva_asr_service
        transcribed_text, detected_lang = await riva_asr_service.transcribe(audio_bytes)
        if not transcribed_text:
            raise HTTPException(status_code=400, detail="Could not understand audio")
        user_message = transcribed_text
        # ✅ KEY FIX: detected_lang from Groq is preserved — NOT overwritten
    elif user_message:
        detected_lang = detect_language_from_script(user_message, default=language)

    lang_name = LANGUAGE_NAMES.get(detected_lang, 'English')

    instruction = ""
    if page_context:
        instruction += f"The user is currently viewing the {page_context} page. "
    instruction += (
        f"Provide a helpful response IN {lang_name.upper()}. "
        "If the user uses a code-mixed language, match their style."
    )
    final_query = (user_message or "") + "\n\n" + instruction
    trimmed_history = process_and_trim_history(session_db_history, final_query, max_conversational_items=6)

    # Save user message
    if user_id and user_message:
        try:
            db = AuthSessionLocal()
            db.add(ChatHistory(user_id=user_id, message=user_message, sender="user"))
            db.commit()
            db.close()
        except Exception:
            pass

    async def event_stream():
        yield f"data: {json.dumps({'type': 'metadata', 'user_text': user_message, 'detected_language': detected_lang})}\n\n"

        full_response = ""
        sentence_buffer = ""
        sentence_end_pattern = re.compile(r'([.?!।]\s+)|([.?!।]$)')

        async for chunk in gemini_service.generate_response_stream(
            message="",
            context=context,
            detected_language=detected_lang,  # ✅ Correct language
            history=trimmed_history
        ):
            full_response += chunk
            sentence_buffer += chunk
            yield f"data: {json.dumps({'type': 'text', 'text': chunk})}\n\n"

            match = sentence_end_pattern.search(sentence_buffer)
            if match:
                end_idx = match.end()
                sentence_to_speak = sentence_buffer[:end_idx].strip()
                sentence_buffer = sentence_buffer[end_idx:]

                clean_sentence = re.sub(r'[*#_`~-]', '', sentence_to_speak).strip()
                if len(clean_sentence) > 2:
                    audio_bytes_out = await riva_tts_service.synthesize(clean_sentence, detected_lang)
                    if audio_bytes_out:
                        audio_b64 = base64.b64encode(audio_bytes_out).decode('utf-8')
                        yield f"data: {json.dumps({'type': 'audio', 'audio_base64': audio_b64})}\n\n"

        # Flush remaining buffer
        if sentence_buffer.strip():
            clean_sentence = re.sub(r'[*#_`~-]', '', sentence_buffer).strip()
            if len(clean_sentence) > 2:
                audio_bytes_out = await riva_tts_service.synthesize(clean_sentence, detected_lang)
                if audio_bytes_out:
                    audio_b64 = base64.b64encode(audio_bytes_out).decode('utf-8')
                    yield f"data: {json.dumps({'type': 'audio', 'audio_base64': audio_b64})}\n\n"

        yield f"data: {json.dumps({'type': 'complete'})}\n\n"

        # Save AI response
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
        history = db.query(ChatHistory).filter(
            ChatHistory.user_id == user.id
        ).order_by(ChatHistory.timestamp).all()
        messages = [{"id": str(m.id), "text": m.message, "sender": m.sender,
                     "timestamp": m.timestamp.isoformat()} for m in history]
        db.close()
        return messages
    except HTTPException:
        raise
    except Exception as e:
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
        db.query(ChatHistory).filter(ChatHistory.user_id == user.id).delete()
        db.commit()
        db.close()
        return {"message": "History deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
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
        msg = db.query(ChatHistory).filter(
            ChatHistory.id == msg_id, ChatHistory.user_id == user.id
        ).first()
        if msg:
            db.delete(msg)
            db.commit()
        db.close()
        return {"message": "Message deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to delete message")


@router.post('/tts')
async def generate_tts(data: TTSRequest):
    text = data.text
    language = detect_language_from_script(text, default=data.language)
    clean_text = re.sub(r'[*#_`~-]', '', text)
    try:
        audio_bytes = await riva_tts_service.synthesize(clean_text, language)
        if audio_bytes:
            audio_b64 = base64.b64encode(audio_bytes).decode('utf-8')
            mime = "audio/wav" if audio_bytes.startswith(b"RIFF") else "audio/mp3"
            return {"audio_url": f"data:{mime};base64,{audio_b64}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS Failure: {str(e)}")
    raise HTTPException(status_code=500, detail="Failed to generate audio")


@router.post('/voice')
async def voice_chat_endpoint(audio: UploadFile = File(...)):
    """Simple voice endpoint: STT → Gemini → TTS."""
    try:
        from app.services.riva_asr_service import riva_asr_service
        audio_bytes = await audio.read()
        user_text, detected_language = await riva_asr_service.transcribe(audio_bytes)
        if not user_text:
            raise HTTPException(status_code=422, detail="Transcription resulted in empty text.")

        gemini_response = gemini_service.generate_response(
            message=user_text,
            context="general",
            detected_language=detected_language  # ✅ Correct language
        )

        audio_url = None
        clean_text = re.sub(r'[*#_`~-]', '', gemini_response)
        tts_audio_bytes = await riva_tts_service.synthesize(clean_text, detected_language)
        if tts_audio_bytes:
            audio_b64 = base64.b64encode(tts_audio_bytes).decode('utf-8')
            mime = "audio/wav" if tts_audio_bytes.startswith(b"RIFF") else "audio/mp3"
            audio_url = f"data:{mime};base64,{audio_b64}"

        return {
            "response_text": gemini_response,
            "user_text": user_text,
            "detected_language": detected_language,
            "audio_url": audio_url
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/settings/env')
def update_env_settings(data: EnvUpdate):
    gemini_key = data.GEMINI_API_KEY
    hf_key = data.HUGGINGFACE_API_KEY
    if not gemini_key and not hf_key:
        return {"message": "No keys provided to update"}
    env_path = '.env'
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
        new_lines.append(f'GEMINI_API_KEY={gemini_key}\n')
    if hf_key and 'HUGGINGFACE_API_KEY' not in keys_updated:
        new_lines.append(f'HUGGINGFACE_API_KEY={hf_key}\n')
    try:
        with open(env_path, 'w') as f:
            f.writelines(new_lines)
        from dotenv import load_dotenv
        load_dotenv(override=True)
        return {"message": "Settings updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to update settings")


@router.post('/generate')
def generate_content(data: GenerateContentRequest):
    topic = data.topic
    type_ = data.type
    language = data.language
    prompt = ""
    if type_ == 'marketing':
        prompt = f"Generate 3 real-world success stories about {topic} in India. Format as JSON with fields: name, location, content, image_prompt. Language: {language}."
    elif type_ == 'schemes':
        prompt = f"List 3 real government schemes for {topic} in India. Format as JSON with fields: name, details, eligibility, application_link, youtube_link. Language: {language}."
    elif type_ == 'vehicles':
        prompt = f"List 3 popular agricultural vehicles for {topic} in India with prices. Format as JSON with fields: name, type, price, purpose, image_prompt. Language: {language}."
    try:
        response = gemini_service.generate_response(prompt, context='general')
        import json
        json_match = re.search(r'\{.*\}|\[.*\]', response, re.DOTALL)
        if json_match:
            return json.loads(json_match.group(0))
        else:
            raise HTTPException(status_code=500, detail={"error": "Failed to parse", "raw": response})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
