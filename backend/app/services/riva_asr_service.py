"""
The Ear - Riva Parakeet ASR Service - EventHorizon AI

NVIDIA NIM cloud ASR (primary) with Groq Whisper / local Whisper fallback.
"""

import os
import io
import struct
import tempfile
import logging
from typing import Optional, Tuple

import httpx

logger = logging.getLogger("eventhorizon.asr")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

SUPPORTED_LANGUAGES = {
    "hi": "hi-IN", "en": "en-IN", "ta": "ta-IN", "te": "te-IN",
    "bn": "bn-IN", "mr": "mr-IN", "gu": "gu-IN", "kn": "kn-IN", "ml": "ml-IN",
}

SCRIPT_RANGES = {
    "hi": ("\u0900", "\u097F"), "ta": ("\u0B80", "\u0BFF"),
    "te": ("\u0C00", "\u0C7F"), "bn": ("\u0980", "\u09FF"),
    "kn": ("\u0C80", "\u0CFF"), "ml": ("\u0D00", "\u0D7F"),
    "gu": ("\u0A80", "\u0AFF"),
}




def detect_language_from_text(text: str, default: str = "en") -> str:
    """Detect language from transcribed text using Unicode script ranges."""
    for lang, (start, end) in SCRIPT_RANGES.items():
        if any(start <= c <= end for c in text):
            return lang
    return default


class RivaASRService:
    """
    Multi-tier ASR service:
      Tier 1: Groq Whisper API
      Tier 2: Local Whisper tiny
    """
    def __init__(self):
        self._groq_available = bool(GROQ_API_KEY)
        self._groq_available = bool(GROQ_API_KEY)
        self._local_whisper = None
        tiers = []
        if self._groq_available: tiers.append("Groq Whisper")
        tiers.append("Local Whisper-tiny")
        logger.info(f"[ASR] Tiers: {' -> '.join(tiers)}")

    async def transcribe(self, audio_bytes: bytes, language_hint: str = "hi") -> Tuple[str, str]:
        """Transcribe audio. Returns (text, detected_language)."""
        if not audio_bytes:
            return "", language_hint

        # Tier 1: Groq Whisper
        if self._groq_available:
            try:
                result = await self._groq_transcribe(audio_bytes, language_hint)
                if result[0]:
                    logger.info(f"[ASR/Groq] OK: {result[0][:60]}...")
                    return result
            except Exception as e:
                logger.warning(f"[ASR/Groq] Failed: {e}")

        # Tier 2: Local Whisper
        try:
            result = self._local_transcribe(audio_bytes)
            if result[0]:
                logger.info(f"[ASR/Local] OK: {result[0][:60]}...")
                return result
        except Exception as e:
            logger.error(f"[ASR/Local] Failed: {e}")

        return "", language_hint

    async def _groq_transcribe(self, audio_bytes: bytes, lang: str) -> Tuple[str, str]:
        # We deliberately OMIT the language constraint and prompt here.
        # Forcing `language="ta"` while speaking Tanglish causes Whisper-large-v3 to hallucinate
        # phonetic gibberish (e.g., "Apesarata milo ngopurida"). By omitting it, the model
        # perfectly auto-detects Tamil, English, or Tanglish natively.
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                files={"file": ("audio.webm", audio_bytes, "audio/webm")},
                data={
                    "model": "whisper-large-v3-turbo", 
                    "response_format": "verbose_json"
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                return data.get("text", "").strip(), data.get("language", lang)
            raise Exception(f"Groq {resp.status_code}: {resp.text[:200]}")

    def _local_transcribe(self, audio_bytes: bytes) -> Tuple[str, str]:
        if self._local_whisper is None:
            import whisper
            logger.info("[ASR/Local] Loading Whisper-tiny...")
            self._local_whisper = whisper.load_model("tiny")
            
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
            tmp.write(audio_bytes)
            path = tmp.name
        try:
            result = self._local_whisper.transcribe(path)
            return result.get("text", "").strip(), result.get("language", "en")
        finally:
            if os.path.exists(path): os.remove(path)


riva_asr_service = RivaASRService()
