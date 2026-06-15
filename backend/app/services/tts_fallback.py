import os
import base64
import requests
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

SARVAM_API_KEY = os.getenv("SARVAM_API_KEY")

class TTSFallbackService:
    def __init__(self):
        self.sarvam_enabled = bool(SARVAM_API_KEY)
        # Persistent HTTP session for connection pooling (reuses TCP+TLS)
        self._session = requests.Session()

        if self.sarvam_enabled:
            print("[TTS FALLBACK] Sarvam AI Initialized successfully (Model: bulbul:v3).")
        else:
            print("[TTS FALLBACK] Warning: SARVAM_API_KEY not found. Sarvam AI fallback disabled.")

    def generate_speech(self, text: str, language: str = "en") -> Optional[bytes]:
        """
        Synthesize speech using Sarvam AI REST API (bulbul:v3 model).
        This is the token-free fallback when Gemini TTS is unavailable.
        """
        # Clean text formatting: strip markdown
        clean_text = text.replace("**", "").replace("*", "").replace("#", "")

        if not self.sarvam_enabled or not SARVAM_API_KEY:
            print("[TTS FALLBACK] Sarvam AI is not configured. No fallback available.")
            return None

        try:
            # Map dialect language code to Sarvam language code
            # Supported: hi-IN, bn-IN, kn-IN, ml-IN, mr-IN, od-IN, pa-IN, ta-IN, te-IN, gu-IN, en-IN
            lang_code = "en-IN"
            speaker = "shubh"

            mapped_lang = language.lower()
            if "ta" in mapped_lang:
                lang_code = "ta-IN"
                speaker = "kavitha"
            elif "hi" in mapped_lang:
                lang_code = "hi-IN"
                speaker = "ritu"
            elif "te" in mapped_lang:
                lang_code = "te-IN"
                speaker = "kavitha"
            elif "kn" in mapped_lang:
                lang_code = "kn-IN"
                speaker = "kavitha"
            elif "ml" in mapped_lang:
                lang_code = "ml-IN"
                speaker = "kavitha"
            elif "bn" in mapped_lang:
                lang_code = "bn-IN"
                speaker = "ritu"
            elif "mr" in mapped_lang:
                lang_code = "mr-IN"
                speaker = "ritu"
            elif "pa" in mapped_lang:
                lang_code = "pa-IN"
                speaker = "ritu"
            elif "gu" in mapped_lang:
                lang_code = "gu-IN"
                speaker = "ritu"

            print(f"[TTS FALLBACK] Querying Sarvam AI TTS (speaker: {speaker}, lang: {lang_code}) for: '{clean_text[:50]}...'")
            
            url = "https://api.sarvam.ai/text-to-speech"
            headers = {
                "api-subscription-key": SARVAM_API_KEY.strip(),
                "Content-Type": "application/json"
            }
            payload = {
                "text": clean_text,
                "speaker": speaker,
                "target_language_code": lang_code,
                "pace": 1.0,
                "model": "bulbul:v3"
            }

            response = self._session.post(url, headers=headers, json=payload, timeout=8)
            
            if response.status_code == 200:
                data = response.json()
                audios = data.get("audios", [])
                audio_b64 = audios[0] if audios else None
                if audio_b64:
                    print(f"[TTS FALLBACK SUCCESS] Received Sarvam AI audio ({len(audio_b64)} b64 chars).")
                    return base64.b64decode(audio_b64)
                else:
                    print("[TTS FALLBACK WARNING] Sarvam responded with success but empty base64 string.")
            else:
                print(f"[TTS FALLBACK WARNING] Sarvam API responded with status {response.status_code}: {response.text[:200]}")
        except Exception as e:
            print(f"[TTS FALLBACK EXCEPTION] Sarvam AI failed: {e}")

        return None

tts_fallback_service = TTSFallbackService()

