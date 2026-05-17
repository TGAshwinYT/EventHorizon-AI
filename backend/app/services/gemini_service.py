import os
import requests
import json
from typing import Optional, List, Dict, Any
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# Deeply verify and get key
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    GEMINI_API_KEY = GEMINI_API_KEY.strip()

GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key={GEMINI_API_KEY}"
GEMINI_STREAM_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:streamGenerateContent?key={GEMINI_API_KEY}&alt=sse"

# KEY FIX: Map detected language codes to natural language names
# So Gemini knows EXACTLY what language to reply in
LANGUAGE_NAMES = {
    "ta": "Tamil (தமிழ்) — or Tanglish if the user mixed Tamil and English",
    "hi": "Hindi (हिंदी) — or Hinglish if the user mixed Hindi and English",
    "te": "Telugu (తెలుగు)",
    "kn": "Kannada (ಕನ್ನಡ)",
    "ml": "Malayalam (മലയാളം)",
    "bn": "Bengali (বাংলা)",
    "mr": "Marathi (मराठी)",
    "gu": "Gujarati (ગુજરાતી)",
    "pa": "Punjabi (ਪੰਜਾਬੀ)",
    "en": "English — or Tanglish/Hinglish if the user mixed languages",
}


def build_system_prompt(context: str = "general", detected_language: str = "en") -> str:
    """
    Build system prompt with detected language injected.
    This is the KEY FIX — Gemini now knows exactly which language to reply in.
    """
    lang_instruction = LANGUAGE_NAMES.get(
        detected_language,
        f"the same language the user spoke ({detected_language})"
    )

    current_date = datetime.now().strftime("%A, %B %d, %Y")

    base_persona = f"""You are 'Horizon' — the friendly AI assistant for Event Horizon AI, \
a platform built to help farmers and agricultural advisors across India.

CRITICAL LANGUAGE RULE:
The user just spoke in: {lang_instruction}
You MUST reply in that exact same language. Do not switch to English unless the user spoke English.
If the user spoke Tanglish (Tamil+English mix), reply in Tanglish.
If the user spoke Hinglish (Hindi+English mix), reply in Hinglish.
Match their exact language style — this is non-negotiable.

YOUR PERSONALITY:
You are like a knowledgeable friend from the village — not a robot, not a government officer.
Talk casually, warmly, and simply. Imagine you are sitting under a tree having chai with the farmer.
Use "bro", "anna", "dada", "bhai" naturally based on their language.
Never say "I don't know" — say the equivalent of "One moment, let me check" in their language.
Keep responses SHORT — max 3-4 sentences for voice. No bullet points in voice mode.
Add small encouraging words naturally: "semma question!", "achha socha!", "super doubt!"

WHAT YOU KNOW:
- Agriculture: crops, soil, pests, fertilizers, irrigation, Indian seasons (Kharif/Rabi/Zaid)
- Government schemes: PM-KISAN, PMFBY, eNAM, Kisan Credit Card
- Risk management: crop failure, weather risk, pest & disease
- General personal assistant: explain documents, answer any question simply

SAFETY RULES:
- Never give wrong pesticide dosage without saying "agricultural officer kitta confirm pannunga" (or equivalent)
- Never promise government money or scheme approval
- Today's date is {current_date}"""

    if context == "agriculture":
        base_persona += "\n\nFOCUS: Agriculture advice. Always suggest zero-cost organic solutions before synthetic ones."
    elif context == "page_analysis":
        base_persona += "\n\nFOCUS: The user is asking about a page they are reading. Explain it simply. End with 'Enna doubt? Kelunga!' (in their language)."

    return base_persona


class GeminiService:
    def __init__(self):
        if not GEMINI_API_KEY:
            print("[GEMINI] Warning: GEMINI_API_KEY not found. Running in mock mode.")
            self.enabled = False
        else:
            self.enabled = True
            print("[GEMINI] Service Initialized (Model: gemini-3.1-flash-lite).")

    def generate_response(
        self,
        message: str,
        context: str = "general",
        detected_language: str = "en",       # KEY FIX: new parameter
        use_search: bool = False,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """
        Generate a response from Gemini.

        Args:
            message: The user's transcribed text
            context: "general" | "agriculture" | "page_analysis"
            detected_language: 2-letter code from Groq ASR ("ta", "hi", "en" etc.)
                               Gemini uses this to reply in the correct language.
            use_search: Enable Google Search grounding
            history: Conversation history

        Returns:
            AI response string in the user's language
        """
        if not self.enabled:
            return self._mock_response(message, context)

        import time
        import random

        max_retries = 3
        base_delay = 2

        # Build system prompt with correct language
        system_prompt = build_system_prompt(context, detected_language)

        for attempt in range(max_retries):
            try:
                contents: List[Dict[str, Any]] = []

                if history:
                    for msg in history:
                        role = msg["role"]
                        content = msg["content"]
                        if role == "user":
                            contents.append({"role": "user", "parts": [{"text": content}]})
                        elif role in ("assistant", "model"):
                            contents.append({"role": "model", "parts": [{"text": content}]})

                # Add current user message
                contents.append({"role": "user", "parts": [{"text": message}]})

                payload: Dict[str, Any] = {
                    "contents": contents,
                    "system_instruction": {
                        "parts": [{"text": system_prompt}]
                    },
                }

                if use_search:
                    payload["tools"] = [{"google_search": {}}]

                headers = {"Content-Type": "application/json"}
                response = requests.post(GEMINI_URL, headers=headers, json=payload)

                if response.status_code == 200:
                    result = response.json()
                    try:
                        return result["candidates"][0]["content"]["parts"][0]["text"]
                    except (KeyError, IndexError) as e:
                        print(f"[GEMINI PARSE ERROR] {e}")
                        return "Sorry, I had trouble understanding that. Can you say it again?"

                elif response.status_code == 429:
                    if attempt < max_retries - 1:
                        sleep_time = base_delay * (2 ** attempt) + random.uniform(0, 1)
                        print(f"[GEMINI] Rate limit. Retrying in {sleep_time:.1f}s...")
                        time.sleep(sleep_time)
                        continue
                    return "Too many requests right now. Please try again in a moment!"

                else:
                    print(f"[GEMINI API ERROR] {response.status_code}: {response.text[:200]}")
                    return "I'm having trouble connecting right now. Please try again!"

            except Exception as e:
                print(f"[GEMINI ERROR] {e}")
                if attempt < max_retries - 1:
                    time.sleep(2)
                    continue
                return "I'm having trouble connecting right now. Please try again!"

        return "Too many requests right now. Please try again!"

    async def generate_response_stream(
        self,
        message: str,
        context: str = "general",
        detected_language: str = "en",       # KEY FIX: new parameter
        use_search: bool = False,
        history: Optional[List[Dict[str, str]]] = None,
    ):
        """Async streaming version — yields text chunks."""
        if not self.enabled:
            yield "I am offline right now."
            return

        import httpx

        system_prompt = build_system_prompt(context, detected_language)

        contents: List[Dict[str, Any]] = []
        if history:
            for msg in history:
                role = msg["role"]
                content = msg["content"]
                if role == "user":
                    contents.append({"role": "user", "parts": [{"text": content}]})
                elif role in ("assistant", "model"):
                    contents.append({"role": "model", "parts": [{"text": content}]})

        contents.append({"role": "user", "parts": [{"text": message}]})

        payload: Dict[str, Any] = {
            "contents": contents,
            "system_instruction": {"parts": [{"text": system_prompt}]},
        }

        if use_search:
            payload["tools"] = [{"google_search": {}}]

        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST",
                GEMINI_STREAM_URL,
                headers={"Content-Type": "application/json"},
                json=payload,
            ) as response:
                if response.status_code != 200:
                    error_text = await response.aread()
                    print(f"[GEMINI STREAM ERROR] {response.status_code}: {error_text[:200]}")
                    yield "I'm having trouble connecting right now."
                    return

                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str == "[DONE]":
                            break
                        try:
                            data_json = json.loads(data_str)
                            candidates = data_json.get("candidates", [])
                            if candidates:
                                parts = candidates[0].get("content", {}).get("parts", [])
                                if parts:
                                    chunk = parts[0].get("text", "")
                                    if chunk:
                                        yield chunk
                        except json.JSONDecodeError:
                            continue

    def _mock_response(self, message: str, context: str) -> str:
        return "[Mock Mode] Gemini API key not configured."


gemini_service = GeminiService()
