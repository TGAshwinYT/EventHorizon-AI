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
import base64
import uuid
import json

logger = logging.getLogger("eventhorizon.tts")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Indic Parler-TTS voice descriptions mapped by language
VOICE_DESCRIPTIONS = {
    "ta": "Tamil female speaker, warm and friendly tone, natural and clear recording.",
    "hi": "Hindi female speaker, warm and empathetic village friend voice, standard quality.",
    "te": "Telugu female speaker, warm and natural expressive tone.",
    "bn": "Bengali female speaker, warm, clear, and natural tone.",
    "mr": "Marathi female speaker, warm and clear tone.",
    "gu": "Gujarati female speaker, warm and friendly tone.",
    "kn": "Kannada female speaker, warm and friendly natural voice.",
    "ml": "Malayalam female speaker, warm and clear voice.",
    "en": "English female speaker with a clear Indian accent, warm and natural tone."
}


def clean_text_for_tts(text: str) -> str:
    """Remove markdown, special chars, and formatting from text for TTS."""
    text = re.sub(r'[*#_`~\-]', '', text)
    text = re.sub(r'\|\|\|.*', '', text)  # Remove ||| delimiter and everything after
    text = re.sub(r'\s+', ' ', text).strip()
    return text


class RivaTTSService:
    """
    Tier 1: Gemini 3 Flash TTS (REST API) — primary
    Tier 2: Indic Parler-TTS (AI4Bharat Space) — fallback
    """
    def __init__(self):
        self._gemini_available = bool(GEMINI_API_KEY)
        logger.info(f"[TTS] Initialized (Gemini: {'✓' if self._gemini_available else '✗'}, Indic Parler-TTS: ✓)")

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

        # Tier 1: Gemini TTS
        if self._gemini_available:
            try:
                audio = await self._gemini_synthesize(clean, language)
                if audio:
                    logger.info(f"[TTS/Gemini] OK: {len(audio)} bytes for '{clean[:40]}...'")
                    return audio
            except Exception as e:
                logger.error(f"[TTS/Gemini] Failed: {e}. Falling back to Indic Parler-TTS.")
                
        # Tier 2: Indic Parler-TTS
        try:
            audio = await self._indic_parler_synthesize(clean, language)
            if audio:
                logger.info(f"[TTS/IndicParler] OK: {len(audio)} bytes for '{clean[:40]}...'")
                return audio
        except Exception as e:
            logger.error(f"[TTS/IndicParler] Failed: {e}")
            
        return None

    # -----------------------------------------------------------------------
    # Tier 1: Gemini 3 Flash TTS
    # -----------------------------------------------------------------------

    async def _gemini_synthesize(self, text: str, language: str) -> Optional[bytes]:
        """Synthesize via Gemini 3 Flash REST API."""
        # Using gemini-2.5-flash as the primary fast multimodal model for generation
        # We instruct Gemini to speak the provided text in the requested language
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key={GEMINI_API_KEY}"
        
        # We instruct Gemini to speak the provided text in the requested language
        # For voices: Aoede, Puck, Charon, Kore, Fenrir
        payload = {
            "contents": [{"parts": [{"text": text}]}],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {
                    "voiceConfig": {
                        "prebuiltVoiceConfig": {
                            "voiceName": "Aoede"
                        }
                    }
                }
            }
        }
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                url,
                headers={"Content-Type": "application/json"},
                json=payload
            )
            
            if response.status_code != 200:
                raise Exception(f"Gemini API Error {response.status_code}: {response.text[:200]}")
                
            data = response.json()
            try:
                parts = data["candidates"][0]["content"]["parts"]
                for part in parts:
                    if "inlineData" in part and part["inlineData"]["mimeType"].startswith("audio"):
                        audio_b64 = part["inlineData"]["data"]
                        return base64.b64decode(audio_b64)
            except (KeyError, IndexError) as e:
                raise Exception(f"Failed to parse Gemini response for audio: {e}")
                
            raise Exception("No audio returned by Gemini model.")

    # -----------------------------------------------------------------------
    # Tier 2: Indic Parler-TTS
    # -----------------------------------------------------------------------

    async def _indic_parler_synthesize(self, text: str, language: str) -> Optional[bytes]:
        """Synthesize via AI4Bharat's Indic Parler-TTS hosted on Hugging Face Spaces (GPU)."""
        description = VOICE_DESCRIPTIONS.get(language, VOICE_DESCRIPTIONS["en"])
        space_url = "https://ai4bharat-indic-parler-tts.hf.space"
        join_url = f"{space_url}/gradio_api/queue/join"
        session_hash = str(uuid.uuid4()).replace("-", "")[:11]
        
        payload = {
            "data": [text, description],
            "fn_index": 3,  # generate_base
            "session_hash": session_hash
        }
        
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(join_url, json=payload)
                if resp.status_code != 200:
                    logger.error(f"[TTS/IndicParler] Failed to join queue: {resp.text}")
                    return None
                    
                event_id = resp.json().get("event_id")
                
                # Poll via SSE using the async client stream
                data_url = f"{space_url}/gradio_api/queue/data?session_hash={session_hash}"
                audio_url = None
                
                # Set a budget of 25 seconds for generation
                async with client.stream("GET", data_url, timeout=25.0) as r:
                    async for line in r.aiter_lines():
                        if line.startswith("data:"):
                            event_data = json.loads(line[5:])
                            msg = event_data.get("msg")
                            
                            if msg == "process_completed":
                                success = event_data.get("success")
                                if success:
                                    output_files = event_data["output"]["data"]
                                    audio_info = output_files[0]
                                    audio_url = audio_info.get("url")
                                    if not audio_url.startswith("http"):
                                        audio_url = f"{space_url}/gradio_api/file={audio_info.get('path')}"
                                    break
                                else:
                                    logger.error(f"[TTS/IndicParler] Processing failed: {event_data.get('output', {}).get('error')}")
                                    return None
                
                if not audio_url:
                    logger.error("[TTS/IndicParler] Timeout or ended without audio URL")
                    return None
                    
                # Download audio
                audio_resp = await client.get(audio_url, timeout=15.0)
                if audio_resp.status_code == 200:
                    return audio_resp.content
                    
                logger.error(f"[TTS/IndicParler] Failed to download audio: {audio_resp.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"[TTS/IndicParler] Error during synthesis: {e}")
            return None


riva_tts_service = RivaTTSService()
