"""
WebSocket Voice Pipeline - EventHorizon AI

Real-time ASR -> LLM -> TTS pipeline over WebSocket.

KEY FIX: language_hint="hi" removed entirely.
         Groq Whisper auto-detects language.
         detected_lang flows correctly to Gemini and TTS.
"""

import asyncio
import base64
import json
import logging
import struct
import time
import re
from typing import Optional, List

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from starlette.websockets import WebSocketState

from app.services.opus_decoder import assemble_chunks_to_pcm
from app.services.riva_asr_service import riva_asr_service, detect_language_from_text
from app.services.gemini_service import gemini_service
from app.services.riva_tts_service import riva_tts_service
from app.auth import decode_access_token

logger = logging.getLogger("eventhorizon.voice_pipeline")

router = APIRouter()

MAX_CONCURRENT_SESSIONS = 32
FLAG_FIRST_CHUNK = 0x0001
FLAG_LAST_CHUNK  = 0x0002
FLAG_BUFFERED    = 0x0004

_active_sessions: int = 0
_session_lock = asyncio.Lock()


async def _increment_sessions() -> bool:
    global _active_sessions
    async with _session_lock:
        if _active_sessions >= MAX_CONCURRENT_SESSIONS:
            return False
        _active_sessions += 1
        logger.info(f"[Pipeline] Sessions: {_active_sessions}/{MAX_CONCURRENT_SESSIONS}")
        return True


async def _decrement_sessions():
    global _active_sessions
    async with _session_lock:
        _active_sessions = max(0, _active_sessions - 1)


def _parse_binary_frame(data: bytes) -> Optional[dict]:
    if len(data) < 4:
        return None
    seq   = struct.unpack(">H", data[0:2])[0]
    flags = struct.unpack(">H", data[2:4])[0]
    return {
        "seq":        seq,
        "is_first":   bool(flags & FLAG_FIRST_CHUNK),
        "is_last":    bool(flags & FLAG_LAST_CHUNK),
        "is_buffered":bool(flags & FLAG_BUFFERED),
        "payload":    data[4:],
    }


async def _safe_send_json(ws: WebSocket, msg: dict):
    try:
        if ws.client_state == WebSocketState.CONNECTED:
            await ws.send_json(msg)
    except Exception:
        pass


@router.websocket("/ws/audio")
async def voice_pipeline_ws(
    websocket: WebSocket,
    token: Optional[str] = Query(default=None),
):
    """
    Main WebSocket endpoint for the real-time voice pipeline.

    KEY FIX SUMMARY:
    - Removed: language_hint = msg.get("language", "hi")
    - riva_asr_service.transcribe() now called with NO language hint
    - detected_lang from Groq flows to Gemini and TTS unchanged
    """

    # Auth
    user_id = None
    if token:
        try:
            payload = decode_access_token(token)
            if payload:
                user_id = payload.get("sub")
        except Exception:
            pass

    # Capacity check
    if not await _increment_sessions():
        await websocket.accept()
        await _safe_send_json(websocket, {
            "type": "error",
            "message": "Server at capacity. Please try again later.",
        })
        await websocket.close(code=1013)
        return

    await websocket.accept()
    logger.info(f"[Pipeline] Client connected (user={user_id})")

    session_id: Optional[str] = None
    audio_chunks: List[bytes] = []
    session_active = False
    # ✅ KEY FIX: No language_hint stored — auto-detection handles it

    try:
        while True:
            message = await asyncio.wait_for(
                websocket.receive(),
                timeout=120
            )

            if "text" in message:
                try:
                    msg = json.loads(message["text"])
                except json.JSONDecodeError:
                    continue

                msg_type = msg.get("type", "")

                if msg_type == "ping":
                    await _safe_send_json(websocket, {"type": "pong"})

                elif msg_type == "session_start":
                    session_id    = msg.get("sessionId", f"s_{int(time.time())}")
                    audio_chunks  = []
                    session_active = True
                    # ✅ KEY FIX: We intentionally do NOT read msg.get("language")
                    # Language will be auto-detected by Groq Whisper from the audio itself
                    await _safe_send_json(websocket, {
                        "type": "session_ack",
                        "sessionId": session_id,
                    })
                    logger.info(f"[Pipeline] Session started: {session_id} (language=auto-detect)")

                elif msg_type == "session_end":
                    if session_active and audio_chunks:
                        await _run_pipeline(websocket, audio_chunks, session_id, user_id)
                    session_active = False
                    audio_chunks  = []

            elif "bytes" in message:
                raw = message["bytes"]
                if not raw:
                    continue

                frame = _parse_binary_frame(raw)
                if not frame:
                    continue

                if frame["is_first"]:
                    audio_chunks  = []
                    session_active = True

                if frame["payload"] and len(frame["payload"]) > 0:
                    audio_chunks.append(frame["payload"])

                if frame["is_last"]:
                    if audio_chunks:
                        await _run_pipeline(websocket, audio_chunks, session_id, user_id)
                    session_active = False
                    audio_chunks  = []

    except WebSocketDisconnect:
        logger.info(f"[Pipeline] Client disconnected (user={user_id})")
    except asyncio.TimeoutError:
        await _safe_send_json(websocket, {"type": "error", "message": "Connection timed out"})
    except Exception as e:
        logger.error(f"[Pipeline] Unexpected error: {e}")
        await _safe_send_json(websocket, {"type": "error", "message": str(e)})
    finally:
        await _decrement_sessions()
        try:
            await websocket.close()
        except Exception:
            pass


async def _run_pipeline(
    ws: WebSocket,
    audio_chunks: List[bytes],
    session_id: Optional[str],
    user_id: Optional[str],
):
    """
    Full ASR → LLM → TTS pipeline.

    LANGUAGE FLOW (fixed):
      audio_chunks
        ↓
      Groq Whisper (NO language param) → auto-detects → detected_lang
        ↓
      Unicode second-pass verify → text_lang
        ↓
      Gemini (detected_language=text_lang) → replies in correct language
        ↓
      TTS (language=text_lang) → speaks in correct language
    """
    pipeline_start = time.time()

    try:
        # ── STAGE 1: Decode Opus → PCM ──────────────────────────
        pcm_audio = assemble_chunks_to_pcm(audio_chunks, input_format="webm")
        if not pcm_audio:
            await _safe_send_json(ws, {
                "type": "error",
                "message": "Failed to decode audio. Please try again.",
            })
            return

        decode_time = time.time() - pipeline_start
        logger.info(f"[Pipeline] Decode: {decode_time:.2f}s, {len(pcm_audio)} bytes PCM")

        # ── STAGE 2: ASR — auto language detection ───────────────
        asr_start = time.time()

        # ✅ KEY FIX: No language_hint passed — pure auto-detection
        transcript, detected_lang = await riva_asr_service.transcribe(pcm_audio)

        if not transcript:
            await _safe_send_json(ws, {
                "type": "error",
                "message": "Could not understand the audio. Please speak clearly.",
            })
            return

        asr_time = time.time() - asr_start

        # Second-pass Unicode verification (catches Tanglish/Hinglish edge cases)
        text_lang = detect_language_from_text(transcript, detected_lang)

        if text_lang != detected_lang:
            logger.info(f"[Pipeline] Unicode verify: {detected_lang} → {text_lang}")

        await _safe_send_json(ws, {
            "type": "transcript_final",
            "text": transcript,
            "language": text_lang,
        })
        logger.info(
            f"[Pipeline] ASR: {asr_time:.2f}s | "
            f"lang={text_lang} | '{transcript[:60]}...'"
        )

        # ── STAGE 3: LLM — streaming with correct language ───────
        llm_start = time.time()
        full_response = ""
        sentence_buffer = ""
        sentence_count = 0

        history = await _load_user_history(user_id) if user_id else []

        sentence_end_pattern = re.compile(r'([.?!।]\s+)|([.?!।]$)')

        async for chunk in gemini_service.generate_response_stream(
            message=transcript,
            context="agriculture",
            detected_language=text_lang,  # ✅ Correct language from ASR
            history=history,
        ):
            full_response += chunk
            sentence_buffer += chunk

            match = sentence_end_pattern.search(sentence_buffer)
            if match:
                end_idx = match.end()
                sentence_to_speak = sentence_buffer[:end_idx].strip()
                sentence_buffer   = sentence_buffer[end_idx:]

                await _safe_send_json(ws, {
                    "type": "llm_chunk",
                    "text": sentence_to_speak + " ",
                })
                sentence_count += 1

                # ── STAGE 4: TTS per sentence ─────────────────────
                try:
                    clean = re.sub(r'[*#_`~-]', '', sentence_to_speak).strip()
                    if len(clean) > 2:
                        tts_audio = await riva_tts_service.synthesize(
                            clean,
                            language=text_lang,  # ✅ Same correct language
                            output_format="mp3"
                        )
                        if tts_audio:
                            await _safe_send_json(ws, {
                                "type": "tts_audio",
                                "data": base64.b64encode(tts_audio).decode("utf-8"),
                                "format": "mp3",
                            })
                except Exception as e:
                    logger.warning(f"[Pipeline] TTS failed for sentence: {e}")

        # Flush remaining buffer
        if sentence_buffer.strip():
            final_sentence = sentence_buffer.strip()
            await _safe_send_json(ws, {
                "type": "llm_chunk",
                "text": final_sentence,
            })
            sentence_count += 1
            try:
                clean = re.sub(r'[*#_`~-]', '', final_sentence).strip()
                if len(clean) > 2:
                    tts_audio = await riva_tts_service.synthesize(
                        clean,
                        language=text_lang,
                        output_format="mp3"
                    )
                    if tts_audio:
                        await _safe_send_json(ws, {
                            "type": "tts_audio",
                            "data": base64.b64encode(tts_audio).decode("utf-8"),
                            "format": "mp3",
                        })
            except Exception as e:
                logger.warning(f"[Pipeline] TTS failed for final sentence: {e}")

        llm_time   = time.time() - llm_start
        total_time = time.time() - pipeline_start

        await _safe_send_json(ws, {"type": "pipeline_complete"})
        logger.info(
            f"[Pipeline] Done in {total_time:.2f}s "
            f"(decode={decode_time:.2f}s asr={asr_time:.2f}s "
            f"llm+tts={llm_time:.2f}s sentences={sentence_count})"
        )

        if user_id:
            await _save_to_history(user_id, transcript, full_response.strip())

    except Exception as e:
        logger.error(f"[Pipeline] Error: {e}")
        import traceback
        traceback.print_exc()
        await _safe_send_json(ws, {
            "type": "error",
            "message": "An error occurred processing your request.",
        })


async def _load_user_history(username: str) -> List[dict]:
    try:
        from app.database import AuthSessionLocal
        from app.models import User, ChatHistory
        db = AuthSessionLocal()
        user = db.query(User).filter(User.username == username).first()
        if not user:
            db.close()
            return []
        raw = (
            db.query(ChatHistory)
            .filter(ChatHistory.user_id == user.id)
            .order_by(ChatHistory.timestamp.desc())
            .limit(6)
            .all()
        )
        db.close()
        history = []
        for h in reversed(raw):
            role = "assistant" if h.sender == "ai" else "user"
            history.append({"role": role, "content": h.message})
        return history
    except Exception as e:
        logger.warning(f"[Pipeline] Failed to load history: {e}")
        return []


async def _save_to_history(username: str, user_text: str, ai_text: str):
    try:
        from app.database import AuthSessionLocal
        from app.models import User, ChatHistory
        db = AuthSessionLocal()
        user = db.query(User).filter(User.username == username).first()
        if user:
            db.add(ChatHistory(user_id=user.id, message=user_text, sender="user"))
            db.add(ChatHistory(user_id=user.id, message=ai_text,   sender="ai"))
            db.commit()
        db.close()
    except Exception as e:
        logger.warning(f"[Pipeline] Failed to save history: {e}")
