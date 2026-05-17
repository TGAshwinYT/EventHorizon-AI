"""
The Ear - ASR Service - EventHorizon AI

Groq Whisper (primary) → Local Whisper tiny (fallback)
KEY FIX: language=None passed to Groq → true auto-detection
         detected_language returned so Gemini replies in correct language
"""

import os
import tempfile
import logging
from typing import Optional, Tuple

import httpx

logger = logging.getLogger("eventhorizon.asr")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

# All Indian language codes Groq Whisper can detect and return
SUPPORTED_LANGUAGES = {
    "hindi":     "hi",
    "tamil":     "ta",
    "telugu":    "te",
    "kannada":   "kn",
    "malayalam": "ml",
    "bengali":   "bn",
    "marathi":   "mr",
    "gujarati":  "gu",
    "punjabi":   "pa",
    "english":   "en",
}

# Unicode script ranges — used as a SECOND PASS to verify Groq's detected language
SCRIPT_RANGES = {
    "hi": ("\u0900", "\u097F"),  # Devanagari (Hindi, Marathi)
    "ta": ("\u0B80", "\u0BFF"),  # Tamil
    "te": ("\u0C00", "\u0C7F"),  # Telugu
    "bn": ("\u0980", "\u09FF"),  # Bengali
    "kn": ("\u0C80", "\u0CFF"),  # Kannada
    "ml": ("\u0D00", "\u0D7F"),  # Malayalam
    "gu": ("\u0A80", "\u0AFF"),  # Gujarati
    "pa": ("\u0A00", "\u0A7F"),  # Punjabi (Gurmukhi)
}

# Grounding prompts used ONLY after language is detected
# These prevent Whisper from hallucinating unrelated words
GROUNDING_PROMPTS = {
    "ta": "வணக்கம். இது தமிழ் அல்லது தமிழ்-ஆங்கில உரையாடல்.",
    "hi": "नमस्ते। यह हिंदी या हिंग्लिश बातचीत है।",
    "te": "నమస్కారం. ఇది తెలుగు లేదా తెలుగు-ఇంగ్లీష్ సంభాషణ.",
    "kn": "ನಮಸ್ಕಾರ. ಇದು ಕನ್ನಡ ಅಥವಾ ಕನ್ನಡ-ಇಂಗ್ಲಿಷ್ ಸಂಭಾಷಣೆ.",
    "ml": "നമസ്കാരം. ಇದು മലയാളം അല്ലെങ്കിൽ മലയാളം-ഇംഗ്ലീഷ് സംഭാഷണം.",
    "bn": "নমস্কার। এটি বাংলা বা বাংলা-ইংরেজি কথোপকথন।",
    "mr": "नमस्कार. हे मराठी किंवा मराठी-इंग्रजी संभाषण आहे.",
    "gu": "नमस्ते. आ गुजराती अथवा गुजराती-अंग्रेजी वार्तालाप छे.",
    "pa": "ਸਤ ਸ੍ਰੀ ਅਕਾਲ। ਇਹ ਪੰਜਾਬੀ ਜਾਂ ਪੰਜਾਬੀ-ਅੰਗਰੇਜ਼ੀ ਗੱਲਬาਤ ਹੈ।",
    "en": "Hello. This is an English or Hinglish/Tanglish conversation.",
}


def detect_language_from_text(text: str, groq_detected: str = "en") -> str:
    """
    Second-pass language verification using Unicode script ranges.
    
    Why: Groq sometimes returns 'en' for Tanglish/Hinglish even when
    the script has Indian characters mixed in. This catches that.
    
    Returns groq_detected if no Indian script found (handles pure
    Tanglish/Hinglish written in Latin script correctly).
    """
    for lang, (start, end) in SCRIPT_RANGES.items():
        if any(start <= char <= end for char in text):
            return lang
    # No Indian script found → trust Groq's detection (en, or mixed latin)
    return groq_detected


class RivaASRService:
    """
    Multi-tier ASR:
      Tier 1: Groq Whisper API     (cloud, fast, free tier)
      Tier 2: Local Whisper-tiny   (offline fallback)

    CRITICAL CHANGE from old version:
      - language=None passed to Groq (true auto-detect, not forced "hi")
      - detected_language read from Groq response and returned
      - Second-pass Unicode verification catches mixed-script languages
      - Grounding prompt selected AFTER detection, not before
    """

    def __init__(self):
        self._groq_available = bool(GROQ_API_KEY)
        self._local_whisper = None

        tiers = []
        if self._groq_available:
            tiers.append("Groq Whisper (auto-detect)")
        tiers.append("Local Whisper-tiny (fallback)")
        logger.info(f"[ASR] Initialized. Tiers: {' → '.join(tiers)}")

        if not self._groq_available:
            logger.warning("[ASR] GROQ_API_KEY not set! Only local Whisper fallback available.")

    async def transcribe(self, audio_bytes: bytes) -> Tuple[str, str]:
        """
        Transcribe audio with automatic language detection.

        Args:
            audio_bytes: Raw audio bytes (webm/wav/mp3)

        Returns:
            Tuple of (transcribed_text, detected_language_code)
            e.g. ("நீ யாரு", "ta") or ("Nee yaaru bro", "en")

        NOTE: No language_hint parameter anymore!
              Groq auto-detects — we just read the result.
        """
        if not audio_bytes:
            logger.warning("[ASR] Empty audio bytes received.")
            return "", "en"

        # Tier 1: Groq Whisper with auto-detect
        if self._groq_available:
            try:
                text, lang = await self._groq_transcribe(audio_bytes)
                if text.strip():
                    logger.info(f"[ASR/Groq] ✓ lang={lang} | text={text[:80]}")
                    return text.strip(), lang
                else:
                    logger.warning("[ASR/Groq] Empty transcript returned.")
            except Exception as e:
                logger.warning(f"[ASR/Groq] Failed: {e} — falling back to local Whisper.")

        # Tier 2: Local Whisper tiny
        try:
            text, lang = self._local_transcribe(audio_bytes)
            if text.strip():
                logger.info(f"[ASR/Local] ✓ lang={lang} | text={text[:80]}")
                return text.strip(), lang
        except Exception as e:
            logger.error(f"[ASR/Local] Failed: {e}")

        logger.error("[ASR] All tiers failed. Returning empty.")
        return "", "en"

    async def _groq_transcribe(self, audio_bytes: bytes) -> Tuple[str, str]:
        """
        Groq Whisper transcription with TRUE auto language detection.

        KEY CHANGES:
        - 'language' field is NOT sent → Whisper auto-detects
        - We read 'language' from the verbose_json response
        - We run second-pass Unicode verification on the result
        - We use a GENERIC grounding prompt (not language-specific)
          because we don't know the language yet!
        """
        # Generic multilingual grounding prompt
        # This tells Whisper the domain (agriculture + personal assistant)
        # without forcing any specific language
        generic_prompt = (
            "This is a conversation with an AI assistant about farming, agriculture, "
            "or general personal queries. The speaker may use Tamil, Telugu, Hindi, "
            "Kannada, Malayalam, Bengali, Marathi, Punjabi, English, or a mix like "
            "Tanglish or Hinglish. Transcribe exactly as spoken."
        )

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                files={
                    "file": ("audio.webm", audio_bytes, "audio/webm")
                },
                data={
                    "model": "whisper-large-v3-turbo",
                    "response_format": "verbose_json",
                    # NO 'language' field → true auto-detection
                    "prompt": generic_prompt,
                    "temperature": "0.0",
                },
            )

        if resp.status_code != 200:
            raise Exception(f"Groq API error {resp.status_code}: {resp.text[:300]}")

        data = resp.json()
        raw_text = data.get("text", "").strip()
        groq_lang = data.get("language", "english").lower()

        # Groq returns full language names like "tamil", "hindi"
        # Convert to 2-letter code
        detected_lang = SUPPORTED_LANGUAGES.get(groq_lang, groq_lang[:2])

        # Second pass: verify using Unicode script in the actual transcribed text
        # This catches cases where Groq says "en" but text has Tamil/Hindi chars
        verified_lang = detect_language_from_text(raw_text, detected_lang)

        if verified_lang != detected_lang:
            logger.info(
                f"[ASR] Language corrected by Unicode check: "
                f"{detected_lang} → {verified_lang}"
            )

        return raw_text, verified_lang

    def _local_transcribe(self, audio_bytes: bytes) -> Tuple[str, str]:
        """
        Offline fallback using local Whisper-tiny.
        Lazy-loaded only when needed (saves memory on HF Spaces).
        """
        if self._local_whisper is None:
            import whisper
            logger.info("[ASR/Local] Loading Whisper-tiny model...")
            self._local_whisper = whisper.load_model("tiny")
            logger.info("[ASR/Local] Whisper-tiny loaded.")

        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:
            # detect_language=True → Whisper auto-detects (same fix as Groq)
            result = self._local_whisper.transcribe(
                tmp_path,
                task="transcribe",
            )
            raw_text = result.get("text", "").strip()
            groq_lang = result.get("language", "en")
            verified_lang = detect_language_from_text(raw_text, groq_lang)
            return raw_text, verified_lang
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)


# Singleton — imported by voice_pipeline.py and voice.py routers
riva_asr_service = RivaASRService()
