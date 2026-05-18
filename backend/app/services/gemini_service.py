import os
import requests
import json
import base64
from typing import Optional, List, Dict, Any
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# Deeply verify and get key
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if GEMINI_API_KEY:
    GEMINI_API_KEY = GEMINI_API_KEY.strip()

# Primary Brain Model: Gemini 3.1 Flash Lite (Preview)
GEMINI_BRAIN_MODEL = os.getenv("GEMINI_BRAIN_MODEL", "gemini-3.1-flash-lite-preview")
# Fallback models in case of limits or preview quota: prioritizing Gemini 3.1 Flash / Gemini 3 Flash
GEMINI_FALLBACK_MODELS = [
    "gemini-3.1-flash-preview",
    "gemini-3-flash-preview",
    "gemini-2.5-flash",
    "gemini-1.5-flash"
]

# Preset names mapped to Natural Languages
LANGUAGE_NAMES = {
    "ta": "Tamil (தமிழ்) — or Tanglish if the user mixed Tamil and English",
    "hi": "Hindi (हिंदी) — or Hinglish if the user mixed Hindi and English",
    "te": "Telugu (తెలుగు)",
    "kn": "Kannada (ಕನ್ನಡ)",
    "ml": "Malayalam (മലയാളം)",
    "bn": "Bengali (বাংলা)",
    "mr": "Marathi (മরাठी)",
    "gu": "Gujarati (ગુજરાતી)",
    "pa": "Punjabi (ਪੰਜਾਬੀ)",
    "en": "English — or Tanglish/Hinglish if the user mixed languages",
}

def build_system_prompt(context: str = "general", detected_language: str = "en") -> str:
    """
    Build system prompt to establish the highly detailed village-friend persona ('Horizon').
    """
    current_date = datetime.now().strftime("%A, %B %d, %Y")

    # Map detected language to specific conversational dialetic style guide
    lang_mapping = {
        "ta": "Tamil (Pure Tamil: 'நண்பா, கவலைப்படாதே! நான் சொல்றேன்...')",
        "ta-en": "Tanglish (Tamil + English mix: 'Bro, unga crop ku enna problem? Chill, naan solren!')",
        "hi": "Hindi (Pure Hindi: 'भाई, तुम्हारी फसल का क्या हाल है?')",
        "hi-en": "Hinglish (Hindi + English mix: 'Bhai, tension mat le, sab sort ho jayega!')",
        "te": "Telugu ('అన్నా, మీ పంటకు ఏమైనా సమస్య ఉందా?')",
        "kn": "Kannada ('ಅಣ್ಣ, ನಿಮ್ಮ ಬೆಳೆಗೆ ಏನು தೊಂದರೆ?' / 'ಅಣ್ಣ, ನಿಮ್ಮ ಬೆಳೆಗೆ ಏನು ತೊಂದರೆ?')",
        "ml": "Malayalam ('ചേട്ടാ, എന്ത് പ്രശ്നം?')",
        "bn": "Bengali ('দাদা, কী সমস্যা?')",
        "mr": "Marathi ('दादा, काय त्रास आहे?')",
        "pa": "Punjabi ('ਵੀਰੇ, ਕੀ ਹਾਲ ਹੈ?')",
        "en": "English ('Hey bro, let me help you out!')"
    }
    
    target_lang_instruction = lang_mapping.get(detected_language, f"the same language the user spoke ({detected_language})")

    base_persona = f"""You are "Horizon" — the friendly AI assistant for Event Horizon AI, a platform built to help farmers and agricultural advisors across India.
Today's date is {current_date}.

## WHO YOU ARE
You are like a knowledgeable friend from the village — not a robot, not a government officer. You talk casually, warmly, and simply. You explain complex things like you're sitting with a farmer under a tree and having a chai together.

You are NOT:
- Robotic or formal ("As per the government notification dated...")
- Overly English (don't sound like a city person)
- Giving bookish answers (real, practical advice only)

## HOW YOU TALK
You MUST talk in: {target_lang_instruction}

Always match the user's language. If they switch language mid-chat, you switch too. If they write Tanglish, you reply Tanglish. Feel it naturally like a real person.

## WHAT YOU KNOW
You are an expert in:

1. PAGE ANALYSIS
   - When given page content, you read it fully and explain it simply
   - Never use jargon. Break it down like explaining to a 10th standard student
   - Always end with: "Enna doubt? Kelunga!" (in their language)

2. AGRICULTURE
   - Crop advice for Indian seasons (Kharif, Rabi, Zaid)
   - Soil health, fertilizers, irrigation tips
   - Government schemes: PM-KISAN, PMFBY, eNAM, Kisan Credit Card
   - Mandi prices, MSP rates, market trends
   - Weather impact on crops

3. RISK MANAGEMENT
   Crop Failure Risk:
   - Early warning signs in crops
   - What to do when crop fails
   - Insurance claim process (PMFBY) step by step
   - Backup crop suggestions

   Weather Risk:
   - How to read weather forecasts for farming
   - Drought/flood preparation tips
   - Protecting crops from unseasonal rain
   - Government compensation schemes

   Pest & Disease Risk:
   - Common pests by crop and season
   - Organic and chemical solutions
   - When to call an agricultural officer
   - Preventive measures before pest season

4. PERSONAL ASSISTANT
   - Help understand any document or webpage
   - Explain government forms simply
   - Remind about scheme deadlines (if user enables alerts)
   - Answer any general question the user has

## YOUR PERSONALITY RULES
- Always greet by the user's name if you know it
- Use "bro", "anna", "dada", "bhai" naturally based on language
- Add small encouraging words: "semma question!", "achha socha!", "super doubt!"
- Never say "I don't know" — say "Oru nimisham, naan check pannuven" (or equivalent in their language) and give best answer
- Keep responses SHORT for voice — max 3-4 sentences per reply unless user asks for detail
- If user sounds worried or stressed, acknowledge it first: "Tension padathe bro, naama solve pannurom!" (or equivalent in their language)

## PAGE CONTEXT
When you receive page content automatically:
- First say what page the user is on, in 1 simple sentence
- Ask what they want to know about it
- Wait for their question, then explain that specific part simply
Example: "Bro, neenga ippo PM-KISAN scheme page la irukeega! Enna doubt iruku? Kelunga 😊"

## MEMORY
You remember:
- User's name
- Their location (district/state)
- Their main crop(s)
- Their preferred language
- Past questions and concerns
Use this naturally: "Last time nee paddy pathi ketuney — ippo avlo rain vandhuchu, un crop epdi iruku?"

## VOICE MODE
When responding in voice mode:
- Keep it conversational, short, natural
- No bullet points or lists in voice — speak in flowing sentences
- Use natural pauses with commas
- Sound like a real person talking, not reading

## RESPONSE FORMAT
Text mode → Can use simple formatting, emojis occasionally
Voice mode → Plain flowing sentences only, no special characters

## NEVER DO THIS
- Never give wrong pesticide dosage or chemical advice without saying "agricultural officer kitta confirm pannunga" (or equivalent)
- Never promise government money or scheme approval
- Never share personal data of one user with another
- Never sound robotic, stiff, or like a government pamphlet
"""

    if context == "agriculture":
        base_persona += "\n\nFOCUS: Agriculture advice. Suggest zero-cost organic, natural, or bio-fertilizers before suggesting synthetic chemical options."
    elif context == "page_analysis":
        base_persona += "\n\nFOCUS: The user is asking about the context of the page they are viewing. First say what page the user is on, in 1 simple sentence, and ask what they want to know. End with: 'Enna doubt? Kelunga!' (in their language)."

    return base_persona

class GeminiService:
    def __init__(self):
        if not GEMINI_API_KEY:
            print("[GEMINI] Warning: GEMINI_API_KEY not found. Running in mock mode.")
            self.enabled = False
        else:
            self.enabled = True
            print(f"[GEMINI] Service Initialized. Primary Brain model: {GEMINI_BRAIN_MODEL}")

    def generate_response(
        self,
        message: str,
        context: str = "general",
        detected_language: str = "en",
        history: Optional[List[Dict[str, str]]] = None,
    ) -> str:
        """
        Generate a text response from Gemini using primary and fallback models.
        """
        if not self.enabled:
            return self._mock_response(message)

        system_prompt = build_system_prompt(context, detected_language)
        contents = self._build_contents_payload(message, history)
        
        models_to_try = [GEMINI_BRAIN_MODEL] + GEMINI_FALLBACK_MODELS

        for model in models_to_try:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"
                payload = {
                    "contents": contents,
                    "system_instruction": {"parts": [{"text": system_prompt}]}
                }
                
                response = requests.post(url, headers={"Content-Type": "application/json"}, json=payload, timeout=12)
                
                if response.status_code == 200:
                    result = response.json()
                    return result["candidates"][0]["content"]["parts"][0]["text"]
                else:
                    print(f"[GEMINI BRAIN WARNING] Model {model} failed with {response.status_code}. Trying next model...")
            except Exception as e:
                print(f"[GEMINI BRAIN EXCEPTION] Model {model} failed: {e}")

        return "நண்பா, ஏதோ சின்ன நெட்வொர்க் பிரச்சனை. மீண்டும் ஒருமுறை சொல்லுங்க! (Network error, please try again)"

    def generate_tts(self, text: str, language: str = "en") -> Optional[bytes]:
        """
        Primary TTS: Converts response text to speech using native Gemini multimodal AUDIO modality output.
        """
        if not self.enabled or not GEMINI_API_KEY:
            return None

        # PRESET VOICE names available: Puck, Charon, Kore, Fenrir, Aoede
        # "Aoede" or "Kore" have excellent high-fidelity human conversational warmth
        voice_name = "Kore" 
        
        payload = {
            "contents": [{
                "parts": [{"text": text}]
            }],
            "generationConfig": {
                "responseModalities": ["AUDIO"],
                "speechConfig": {
                    "voiceConfig": {
                        "prebuiltVoiceConfig": {
                            "voiceName": voice_name
                        }
                    }
                }
            }
        }
        
        # Multimodal Audio output is supported on specialized Gemini 3.1 TTS, 2.5, and 2.0 models
        models_to_try = ["gemini-3.1-flash-tts-preview", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-exp"]
        
        for model in models_to_try:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"
                print(f"[GEMINI TTS] Requesting speech audio from model: {model}...")
                response = requests.post(url, headers={"Content-Type": "application/json"}, json=payload, timeout=15)
                
                if response.status_code == 200:
                    result = response.json()
                    parts = result.get("candidates", [{}])[0].get("content", {}).get("parts", [])
                    for part in parts:
                        if "inlineData" in part:
                            data_b64 = part["inlineData"].get("data")
                            if data_b64:
                                print(f"[GEMINI TTS SUCCESS] Generated audio from {model} model successfully.")
                                return base64.b64decode(data_b64)
                    print(f"[GEMINI TTS WARNING] Model {model} returned success but no inlineData audio found.")
                else:
                    print(f"[GEMINI TTS WARNING] Model {model} failed with status {response.status_code}: {response.text[:200]}")
            except Exception as e:
                print(f"[GEMINI TTS EXCEPTION] Model {model} exception: {e}")
                
        return None

    def _build_contents_payload(self, message: str, history: Optional[List[Dict[str, str]]]) -> List[Dict[str, Any]]:
        contents: List[Dict[str, Any]] = []
        if history:
            for msg in history:
                role = msg.get("role", "user")
                # Map assistant role to model role for Gemini API
                role_mapped = "model" if role in ["assistant", "model", "ai"] else "user"
                contents.append({
                    "role": role_mapped,
                    "parts": [{"text": msg.get("content", "")}]
                })
        
        contents.append({
            "role": "user",
            "parts": [{"text": message}]
        })
        return contents

    def _mock_response(self, message: str) -> str:
        return f"[Mock Mode] I understand you asked: '{message}'. Gemini API key is not configured."

gemini_service = GeminiService()
