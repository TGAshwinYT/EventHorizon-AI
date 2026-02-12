import os
import requests
import json
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv
from functools import lru_cache

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    GEMINI_API_KEY = GEMINI_API_KEY.strip()

# Using gemini-2.5-flash (Verified working)
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"

class GeminiService:
    def __init__(self):
        if not GEMINI_API_KEY:
            print("[GEMINI] Warning: GEMINI_API_KEY not found. Running in mock/fallback mode.")
            self.enabled = False
        else:
            self.enabled = True
            print("[GEMINI] REST Service Initialized (Model: gemini-1.5-flash).")

    @lru_cache(maxsize=32)
    def generate_response(self, message: str, audio_data: Optional[bytes] = None, audio_mime_type: str = "audio/mp3", context: str = "general", use_search: bool = False) -> str:
        if not self.enabled:
            return self._mock_response(message, context)

        # Retry configuration
        max_retries = 3
        base_delay = 2  # seconds

        import time
        import random

        for attempt in range(max_retries):
            try:
                # Construct system prompt based on context
                system_prompt = ""
                if context == "agriculture":
                    system_prompt = "You are an expert agricultural advisor for Indian farmers. Provide practical, localized advice on crops, weather, and farming techniques. Keep answers concise and helpful."
                elif context == "education":
                    system_prompt = "You are a vocational training expert helping rural Indians learn new skills."
                else:
                    system_prompt = "You are EventHorizon AI, a helpful assistant for rural Indian communities."

                parts: List[Dict[str, Any]] = []
                
                if audio_data is not None:
                    # Multimodal request: Audio + Prompt
                    import base64
                    from typing import cast
                    encoded_audio = base64.b64encode(cast(bytes, audio_data)).decode('utf-8')
                    parts.append({
                        "inline_data": {
                            "mime_type": audio_mime_type,
                            "data": encoded_audio
                        }
                    })
                    # Instruction for audio processing
                    prompt_text = f"{system_prompt}\n\nUSER AUDIO INPUT RECEIVED.\n"
                    if message:
                        prompt_text += f"ADDITIONAL INSTRUCTIONS: {message}\n"
                    prompt_text += "TASK: 1. Transcribe the user's speech exactly (in original language).\n2. Provide a helpful response to the query.\n3. FOLLOW ADDITIONAL INSTRUCTIONS IF ANY.\n\nOUTPUT FORMAT:\nTranscribed: <user_speech>\nResponse: <ai_response>"
                    parts.append({"text": prompt_text})
                else:
                    # Text-only request
                    full_prompt = f"{system_prompt}\n\nUser: {message}\nAssistant:"
                    parts.append({"text": full_prompt})
                
                payload: Dict[str, Any] = {
                    "contents": [{ "parts": parts }]
                }

                if use_search:
                    payload["tools"] = [{
                        "google_search": {}
                    }]
                
                headers = {'Content-Type': 'application/json'}
                response = requests.post(GEMINI_URL, headers=headers, json=payload)
                
                if response.status_code == 200:
                    result = response.json()
                    try:
                        return result['candidates'][0]['content']['parts'][0]['text']
                    except (KeyError, IndexError) as e:
                        print(f"[GEMINI PARSE ERROR] {e} - Response: {result}")
                        return "I couldn't understand the response from Gemini."
                elif response.status_code == 429:
                    if attempt < max_retries - 1:
                        sleep_time = base_delay * (2 ** attempt) + random.uniform(0, 1)
                        print(f"[GEMINI ADVISORY] Rate limit exceeded (429). Response: {response.text}. Retrying in {sleep_time:.2f}s...")
                        time.sleep(sleep_time)
                        continue
                    else:
                        print(f"[GEMINI ADVISORY] Rate limit exceeded (429). Max retries reached.")
                        return "I am currently receiving too many requests. Please try again later."
                else:
                    print(f"[GEMINI API ERROR] {response.status_code} - {response.text}")
                    return "I'm having trouble connecting to Gemini API right now."
                    
            except Exception as e:
                print(f"[GEMINI CONNECTION ERROR] {e}")
                if attempt < max_retries - 1:
                    time.sleep(2)
                    continue
                return "I'm having trouble connecting to Gemini right now. Please try again later."

        return "I am currently receiving too many requests. Please try again later."

    def _mock_response(self, message: str, context: str) -> str:
        """Fallback mock response"""
        return "I am offline right now (Mock Response)."

gemini_service = GeminiService()
