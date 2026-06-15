import json
import base64
import asyncio
import hashlib
import re
from fastapi import APIRouter, HTTPException, UploadFile, File, Header, Depends, WebSocket, WebSocketDisconnect
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.database import get_auth_db, AsyncAuthSessionLocal
from app.models import User
from app.auth import decode_access_token
from sqlalchemy import select

# Import Schemas
from app.models.schemas import (
    ChatRequest, 
    TTSRequest, 
    MemoryRequest,
    ProfileResponse,
    ProfileUpdateRequest
)

# Import Services
from app.services.gemini_service import gemini_service
from app.services.groq_service import groq_service
from app.services.tts_fallback import tts_fallback_service
from app.services.azure_tts_engine import casual_voice_engine
from app.services.memory_service import memory_service
from app.cache_utils import TTLCache

router = APIRouter()

tts_audio_cache = TTLCache(ttl_seconds=86400)  # Cache generated TTS audio for 24 hours
chat_response_cache = TTLCache(ttl_seconds=3600)  # Cache repeated identical chat queries for 1 hour

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
        history_json = json.dumps(data.history or [], sort_keys=True, separators=(",", ":"), default=str)
        cache_key = f"chat:{data.language}:{data.page_context or 'general'}:{hashlib.sha256((data.message + history_json).encode('utf-8')).hexdigest()}"
        cached_response = chat_response_cache.get(cache_key)
        if cached_response is not None:
            print(f"[CHAT CACHE HIT] language={data.language} page_context={data.page_context or 'general'} text_hash={cache_key[-8:]}")
            return {"response": cached_response, "language": data.language}

        response = gemini_service.generate_response(
            message=data.message,
            context=data.page_context or "general",
            detected_language=data.language,
            history=data.history
        )

        chat_response_cache.set(cache_key, response)
        print(f"[CHAT CACHE SET] language={data.language} page_context={data.page_context or 'general'} text_hash={cache_key[-8:]}")
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
        result = await asyncio.to_thread(groq_service.transcribe_audio, audio_bytes, filename=audio.filename)
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
    Convert text response to speech.
    Primary: Azure Cognitive Neural Casual TTS, then Sarvam AI bulbul:v3, then Gemini 3.1 Flash TTS.
    """
    try:
        cache_key = f"tts:{data.language}:{hashlib.sha256(data.text.encode('utf-8')).hexdigest()}"
        cached_audio = tts_audio_cache.get(cache_key)
        if cached_audio is not None:
            print(f"[TTS CACHE HIT] language={data.language} text_hash={cache_key[-8:]}")
            return Response(content=cached_audio, media_type="audio/wav")

        # Tier 1: Primary — Azure Casual Indian Voice for the most natural conversational sound
        audio_content = casual_voice_engine.speak_natural(text=data.text, lang_code=data.language)
        
        # Tier 2: Fallback — Sarvam AI (free, Indic-native voices)
        if not audio_content:
            print("[TTS FALLBACK TRIGGERED] Azure TTS failed, falling back to Sarvam AI bulbul:v3...")
            audio_content = tts_fallback_service.generate_speech(text=data.text, language=data.language)
            
        # Tier 3: Last Resort Fallback — Gemini multimodal TTS
        if not audio_content:
            print("[TTS LAST FALLBACK TRIGGERED] Both Azure and Sarvam failed, falling back to Gemini TTS...")
            audio_content = gemini_service.generate_tts(text=data.text, language=data.language)

        if not audio_content:
            raise HTTPException(status_code=500, detail="TTS generation failed across all engines (Azure, Sarvam, and Gemini).")

        tts_audio_cache.set(cache_key, audio_content)
        print(f"[TTS CACHE SET] language={data.language} text_hash={cache_key[-8:]}")
            
        # Return audio as binary stream
        return Response(content=audio_content, media_type="audio/wav")
        
    except Exception as e:
        print(f"[ASSISTANT TTS ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))

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


# ──────────── TTS Response Cache (LRU-style, capped) ────────────
_tts_cache: dict[str, bytes] = {}
_TTS_CACHE_MAX = 100


async def race_tts(text: str, language: str, preferred_provider: str = None):
    """
    Race Gemini and Sarvam TTS concurrently.
    Returns (audio_bytes, provider_name) tuple.
    If preferred_provider is set, uses only that provider (no race) for voice consistency.
    Results are cached for repeated phrases.
    """
    cache_key = hashlib.md5(f"{text}:{language}".encode()).hexdigest()
    if cache_key in _tts_cache:
        print(f"[TTS CACHE HIT] Serving cached audio for: '{text[:40]}...'")
        return _tts_cache[cache_key], "cache"

    # If a provider already won for this response, stick with it (consistent voice)
    if preferred_provider == "gemini":
        try:
            audio = await asyncio.to_thread(gemini_service.generate_tts, text, language)
            if audio:
                if len(text) < 300:
                    if len(_tts_cache) >= _TTS_CACHE_MAX:
                        del _tts_cache[next(iter(_tts_cache))]
                    _tts_cache[cache_key] = audio
                return audio, "gemini"
        except Exception as e:
            print(f"[TTS PREFERRED ERROR] Gemini failed: {e}")
        return None, None

    if preferred_provider == "sarvam":
        try:
            audio = await asyncio.to_thread(tts_fallback_service.generate_speech, text, language)
            if audio:
                if len(text) < 300:
                    if len(_tts_cache) >= _TTS_CACHE_MAX:
                        del _tts_cache[next(iter(_tts_cache))]
                    _tts_cache[cache_key] = audio
                return audio, "sarvam"
        except Exception as e:
            print(f"[TTS PREFERRED ERROR] Sarvam failed: {e}")
        return None, None

    if preferred_provider == "azure":
        try:
            audio = await asyncio.to_thread(casual_voice_engine.speak_natural, text, language)
            if audio:
                if len(text) < 300:
                    if len(_tts_cache) >= _TTS_CACHE_MAX:
                        del _tts_cache[next(iter(_tts_cache))]
                    _tts_cache[cache_key] = audio
                return audio, "azure"
        except Exception as e:
            print(f"[TTS PREFERRED ERROR] Azure failed: {e}")
        return None, None

    # No preference yet — race both providers to find the fastest one
    gemini_task = asyncio.create_task(
        asyncio.to_thread(gemini_service.generate_tts, text, language)
    )
    tasks = [gemini_task]
    sarvam_task = None

    if tts_fallback_service.sarvam_enabled:
        sarvam_task = asyncio.create_task(
            asyncio.to_thread(tts_fallback_service.generate_speech, text, language)
        )
        tasks.append(sarvam_task)

    audio_content = None
    winning_provider = None

    if len(tasks) == 1:
        try:
            audio_content = await gemini_task
            if audio_content:
                winning_provider = "gemini"
        except Exception as e:
            print(f"[RACE TTS ERROR] Gemini-only: {e}")
    else:
        done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)

        for task in done:
            try:
                result = task.result()
                if result:
                    audio_content = result
                    winning_provider = "gemini" if task is gemini_task else "sarvam"
                    break
            except Exception:
                pass

        if audio_content:
            for task in pending:
                task.cancel()
        else:
            for task in pending:
                try:
                    result = await task
                    if result:
                        audio_content = result
                        winning_provider = "gemini" if task is gemini_task else "sarvam"
                except Exception:
                    pass

    # Fallback to Azure if both Gemini and Sarvam failed during race
    if not audio_content:
        print("[RACE TTS FALLBACK] Both Gemini and Sarvam failed. Attempting Azure TTS...")
        try:
            audio_content = await asyncio.to_thread(casual_voice_engine.speak_natural, text, language)
            if audio_content:
                winning_provider = "azure"
        except Exception as e:
            print(f"[RACE TTS FALLBACK ERROR] Azure failed: {e}")

    # Cache short phrases
    if audio_content and len(text) < 300:
        if len(_tts_cache) >= _TTS_CACHE_MAX:
            del _tts_cache[next(iter(_tts_cache))]
        _tts_cache[cache_key] = audio_content

    return audio_content, winning_provider


async def tts_worker(websocket: WebSocket, queue: asyncio.Queue, language: str, ws_lock: asyncio.Lock, provider_state: dict):
    """Parallel TTS worker: generates speech with consistent voice per response."""
    while True:
        item = await queue.get()
        if item is None:
            queue.task_done()
            break
        seq, sentence = item
        try:
            print(f"[WS TTS Worker] Generating speech for seq={seq}: '{sentence[:50]}'")
            audio_content, provider = await race_tts(sentence, language, provider_state.get("preferred"))

            # Lock in the winning provider for voice consistency
            if audio_content and provider and not provider_state.get("preferred"):
                provider_state["preferred"] = provider
                print(f"[TTS PROVIDER LOCKED] Using '{provider}' for all remaining chunks in this response.")

            audio_b64 = base64.b64encode(audio_content).decode("utf-8") if audio_content else ""
            async with ws_lock:
                await websocket.send_json({
                    "type": "audio_chunk",
                    "audio": audio_b64,
                    "seq": seq,
                    "text": sentence
                })
        except Exception as tts_err:
            print(f"[WS TTS WORKER ERROR] seq={seq}: {tts_err}")
            try:
                async with ws_lock:
                    await websocket.send_json({
                        "type": "audio_chunk",
                        "audio": "",
                        "seq": seq,
                        "text": sentence
                    })
            except Exception:
                pass
        finally:
            queue.task_done()


def extract_tts_chunks(buffer: str, is_final: bool = False):
    """
    Extracts complete clauses/sentences from buffer.
    Returns (chunks_list, remaining_buffer).
    """
    chunks = []
    strong_delims = {'.', '!', '?', '।', '\n', '\r'}
    weak_delims = {',', ';', ':'}
    MIN_CHUNK_LENGTH = 10
    
    current_idx = 0
    start_idx = 0
    n = len(buffer)
    
    while current_idx < n:
        char = buffer[current_idx]
        if char in strong_delims:
            chunk = buffer[start_idx:current_idx + 1].strip()
            if chunk:
                chunks.append(chunk)
            start_idx = current_idx + 1
        elif char in weak_delims:
            chunk_candidate = buffer[start_idx:current_idx + 1].strip()
            if len(chunk_candidate) >= MIN_CHUNK_LENGTH:
                chunks.append(chunk_candidate)
                start_idx = current_idx + 1
        current_idx += 1
        
    remaining = buffer[start_idx:]
    if is_final and remaining.strip():
        chunks.append(remaining.strip())
        remaining = ""
        
    return chunks, remaining


async def handle_chat_stream(websocket: WebSocket, message: str, language: str, history: list, page_context: str, tts_enabled: bool):
    accumulated_text = ""
    await websocket.send_json({"type": "stream_start"})
    
    NUM_TTS_WORKERS = 3
    tts_queue = asyncio.Queue()
    ws_lock = asyncio.Lock()
    provider_state = {"preferred": None}  # Shared: locks voice to first winning provider
    worker_tasks = []
    
    if tts_enabled:
        worker_tasks = [
            asyncio.create_task(tts_worker(websocket, tts_queue, language, ws_lock, provider_state))
            for _ in range(NUM_TTS_WORKERS)
        ]
    
    generator = gemini_service.generate_response_stream(
        message=message,
        context=page_context,
        detected_language=language,
        history=history
    )
    
    sentence_buffer = ""
    tts_seq = 0
    
    while True:
        try:
            chunk = await asyncio.to_thread(next, generator, None)
            if chunk is None:
                break
            accumulated_text += chunk
            async with ws_lock:
                await websocket.send_json({
                    "type": "text_chunk",
                    "text": chunk
                })
            
            if tts_enabled:
                sentence_buffer += chunk
                chunks, sentence_buffer = extract_tts_chunks(sentence_buffer, is_final=False)
                for tts_chunk in chunks:
                    await tts_queue.put((tts_seq, tts_chunk))
                    tts_seq += 1
        except StopIteration:
            break
        except Exception as e:
            print(f"[WS STREAM GENERATE ERROR] {e}")
            break
            
    if tts_enabled:
        # Flush remaining buffer
        chunks, sentence_buffer = extract_tts_chunks(sentence_buffer, is_final=True)
        for tts_chunk in chunks:
            await tts_queue.put((tts_seq, tts_chunk))
            tts_seq += 1
        # Send poison pills to terminate all workers
        for _ in range(NUM_TTS_WORKERS):
            await tts_queue.put(None)
        # Wait for all workers to finish
        await asyncio.gather(*worker_tasks)
        
    await websocket.send_json({
        "type": "text_complete",
        "text": accumulated_text
    })


@router.websocket("/ws")
async def assistant_websocket(websocket: WebSocket):
    await websocket.accept()
    
    token = websocket.query_params.get("token")
    user = None
    
    # In-memory buffer to accumulate non-cumulative incoming audio chunks
    audio_buffer = bytearray()
    chunk_counter = 0  # For debouncing real-time STT
    
    try:
        if token:
            try:
                payload = decode_access_token(token)
                if payload:
                    username = payload.get("sub")
                    async with AsyncAuthSessionLocal() as db:
                        result = await db.execute(select(User).filter(User.username == username))
                        user = result.scalars().first()
            except Exception as e:
                print(f"[WS AUTH ERROR] {e}")
                
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            msg_type = payload.get("type")
            
            if msg_type == "text":
                message = payload.get("message", "")
                language = payload.get("language", "en")
                history = payload.get("history", [])
                page_context = payload.get("page_context", "general")
                tts_enabled = payload.get("tts_enabled", True)
                
                await handle_chat_stream(websocket, message, language, history, page_context, tts_enabled)
                
            elif msg_type == "audio_chunk":
                audio_b64 = payload.get("audio", "")
                language = payload.get("language", "en")
                
                if audio_b64:
                    chunk_bytes = base64.b64decode(audio_b64)
                    audio_buffer.extend(chunk_bytes)
                    chunk_counter += 1
                    
                    # Debounce: only transcribe every 3rd chunk for real-time preview
                    if chunk_counter % 3 == 0:
                        stt_result = await asyncio.to_thread(
                            groq_service.transcribe_audio, bytes(audio_buffer), "voice.webm"
                        )
                        transcript = stt_result.get("transcript", "")
                        detected_lang = stt_result.get("language_detected", language)
                        
                        await websocket.send_json({
                            "type": "transcript_chunk",
                            "text": transcript,
                            "language_detected": detected_lang
                        })
                    
            elif msg_type == "audio_end":
                audio_b64 = payload.get("audio", "")
                language = payload.get("language", "en")
                history = payload.get("history", [])
                page_context = payload.get("page_context", "general")
                tts_enabled = payload.get("tts_enabled", True)
                
                if audio_b64:
                    chunk_bytes = base64.b64decode(audio_b64)
                    audio_buffer.extend(chunk_bytes)
                
                # Snapshot buffer before clearing (so STT gets the full audio)
                audio_buffer_snapshot = bytes(audio_buffer)
                
                # Clear audio buffer and chunk counter for the next recording session
                audio_buffer.clear()
                chunk_counter = 0
                    
                # Transcribe final accumulated buffer (non-blocking)
                stt_result = await asyncio.to_thread(
                    groq_service.transcribe_audio, audio_buffer_snapshot, "voice.webm"
                )
                transcript = stt_result.get("transcript", "")
                detected_lang = stt_result.get("language_detected", language)
                
                if not transcript.strip():
                    await websocket.send_json({
                        "type": "error",
                        "message": "I could not hear anything. Can you say it again simply?"
                    })
                    continue
                    
                # Send final completed transcript as user input
                await websocket.send_json({
                    "type": "transcript",
                    "text": transcript,
                    "language_detected": detected_lang
                })
                
                await handle_chat_stream(websocket, transcript, detected_lang, history, page_context, tts_enabled)
                    
    except WebSocketDisconnect:
        print("[WS CLIENT DISCONNECTED]")
    except Exception as e:
        print(f"[WS ERROR] {e}")

