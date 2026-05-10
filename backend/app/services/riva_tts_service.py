"""
The Mouth - Riva Magpie TTS Service - EventHorizon AI

Edge-TTS (primary).
Generates audio from text sentences, returns MP3/Opus bytes.
"""

import os
import io
import re
import asyncio
import logging
from typing import Optional, cast, Dict, Any

import httpx

logger = logging.getLogger("eventhorizon.tts")

# Edge-TTS fallback voice profiles
EDGE_VOICE_MAP = {
    "en": "en-IN-NeerjaNeural",
    "hi": "hi-IN-SwaraNeural",
    "ta": "ta-IN-PallaviNeural",
    "te": "te-IN-MohanNeural",
    "bn": "bn-IN-BashkarNeural",
    "mr": "mr-IN-AarohiNeural",
    "gu": "gu-IN-DhwaniNeural",
    "kn": "kn-IN-GaganNeural",
    "ml": "ml-IN-MidhunNeural",
}


def clean_text_for_tts(text: str) -> str:
    """Remove markdown, special chars, and formatting from text for TTS."""
    text = re.sub(r'[*#_`~\-]', '', text)
    text = re.sub(r'\|\|\|.*', '', text)  # Remove ||| delimiter and everything after
    text = re.sub(r'\s+', ' ', text).strip()
    return text


class RivaTTSService:
    """
    Tier 1: Edge-TTS (Microsoft) — free fallback
    """
    def __init__(self):
        logger.info(f"[TTS] Using Edge-TTS fallback")

    async def synthesize(
        self,
        text: str,
        language: str = "hi",
        output_format: str = "mp3",
    ) -> Optional[bytes]:
        """
        Convert text to speech audio bytes.

        Args:
            text: Text to synthesize
            language: 2-letter language code
            output_format: "mp3" or "opus"

        Returns:
            Audio bytes (MP3/Opus) or None on failure
        """
        clean = clean_text_for_tts(text)
        if not clean or len(clean) < 2:
            return None

        # Tier 1: Edge-TTS
        try:
            audio = await self._edge_synthesize(clean, language)
            if audio:
                logger.info(f"[TTS/Edge] OK: {len(audio)} bytes for '{clean[:40]}...'")
                return audio
        except Exception as e:
            logger.error(f"[TTS/Edge] Failed: {e}")

        return None

    # -----------------------------------------------------------------------
    # Tier 1: Edge-TTS
    # -----------------------------------------------------------------------

    async def _edge_synthesize(self, text: str, language: str) -> Optional[bytes]:
        """Synthesize via Microsoft Edge-TTS (free, no API key)."""
        try:
            import edge_tts
        except ImportError:
            logger.error("[TTS/Edge] edge_tts not installed")
            return None

        voice = EDGE_VOICE_MAP.get(language, EDGE_VOICE_MAP["en"])

        try:
            communicate = edge_tts.Communicate(text, voice)
            audio_data = bytearray()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    data = cast(bytes, chunk["data"])
                    audio_data.extend(data)
            return bytes(audio_data) if audio_data else None
        except Exception as e:
            logger.error(f"[TTS/Edge] Stream error: {e}")
            return None


riva_tts_service = RivaTTSService()
