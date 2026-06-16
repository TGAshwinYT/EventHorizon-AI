"""
The Eye - Vision Diagnostic Service - EventHorizon AI

Agentic pipeline for crop disease diagnosis:
  Step 1: NVIDIA NIM nemotron-nano-12b-v2-vl (primary) / Gemini 2.5 Flash (fallback)
  Step 2: Tavily Web Search for remedy pricing (primary) / Gemini Google Search (fallback)
  Step 3: Translation via existing TranslatorService
  Step 4: TTS via existing RivaTTSService

Designed for 2G-optimized input: expects <50KB compressed JPEG Base64 from the frontend.
"""

import os
import json
import re
import logging
import base64
from typing import Optional, Dict, Any
from datetime import datetime

import httpx

from dotenv import load_dotenv
load_dotenv()

from app.cache_utils import TTLCache

logger = logging.getLogger("eventhorizon.vision")

# ── Configuration ──
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# NVIDIA NIM Vision endpoint
NVIDIA_NIM_VISION_URL = os.getenv(
    "NVIDIA_NIM_VISION_URL",
    "https://integrate.api.nvidia.com/v1/chat/completions"
)
NVIDIA_VISION_MODEL = os.getenv(
    "NVIDIA_VISION_MODEL",
    "nvidia/nemotron-nano-12b-v2-vl"
)

def get_gemini_url():
    key = os.getenv("GEMINI_API_KEY", "")
    return f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key={key}"

# ── System Prompt for Vision Model ──
VISION_SYSTEM_PROMPT = """/think
You are an expert agricultural pathologist AI embedded in EventHorizon AI.
Analyze the provided crop/plant image and diagnose any visible disease, pest damage, or nutrient deficiency.

You MUST respond with ONLY a valid JSON object (no markdown, no backticks, no extra text) in this exact structure:
{
  "plant_name": "Name of the plant/crop identified",
  "issue_detected": "Name of the disease, pest, or deficiency detected",
  "cause": "Brief cause (fungus name, bacteria, pest species, or nutrient)",
  "severity": "mild | moderate | severe",
  "recommended_material": "Specific chemical or organic remedy name",
  "organic_alternative": "Zero-cost or low-cost indigenous organic solution (e.g., Jeevamrutha, neem oil)",
  "application_method": "Brief instruction on how to apply the remedy",
  "search_query_trigger": "A search query to find the price of the recommended material in India, e.g. 'Copper Oxychloride 500g price India buy online'",
  "confidence": "high | medium | low"
}

RULES:
1. If the image does NOT show a plant or crop, set issue_detected to "not_a_plant" and fill other fields as "N/A".
2. If the plant appears HEALTHY, set issue_detected to "healthy" and recommended_material to "none_needed".
3. ALWAYS recommend an organic_alternative BEFORE the chemical remedy.
4. The search_query_trigger MUST be specific enough to find pricing on Indian e-commerce sites.
5. Output ONLY the JSON. No explanation, no markdown fencing."""


class VisionDiagnosticService:
    """
    Orchestrates the full crop diagnosis pipeline:
      1. Vision inference (NIM → Gemini fallback)
      2. Remedy price search (Tavily → Gemini Google Search fallback)
      3. Translation (existing TranslatorService)
      4. TTS (existing RivaTTSService)
    """

    def __init__(self):
        self._nim_available = bool(os.getenv("NVIDIA_API_KEY") or NVIDIA_API_KEY)
        self._tavily_available = bool(os.getenv("TAVILY_API_KEY") or TAVILY_API_KEY)
        self._gemini_available = bool(os.getenv("GEMINI_API_KEY") or GEMINI_API_KEY)
        logger.info(
            f"[Vision] NIM: {'✓' if self._nim_available else '✗'} | "
            f"Tavily: {'✓' if self._tavily_available else '✗'} | "
            f"Gemini: {'✓' if self._gemini_available else '✗'}"
        )

    # ═══════════════════════════════════════════════════════════════════════
    # PUBLIC API — Called by the scanner router
    # ═══════════════════════════════════════════════════════════════════════

    async def diagnose(
        self,
        image_base64: str,
        language: str = "en",
        user_query: Optional[str] = None,
        speak_result: bool = True,
        location: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Full diagnostic pipeline.


        Args:
            image_base64: Base64-encoded JPEG image (<50KB from frontend compression)
            language: 2-letter language code for response translation
            user_query: Optional text query from the farmer (e.g., "What's wrong with my tomato?")
            speak_result: Whether to generate TTS audio for the diagnosis

        Returns:
            Dict with diagnosis, price info, translated text, and optional audio URL
        """
        result = {
            "plant_name": "Unknown",
            "issue_detected": "unknown",
            "cause": "Unable to determine",
            "severity": "unknown",
            "recommended_material": "N/A",
            "organic_alternative": "N/A",
            "application_method": "N/A",
            "search_query_trigger": "",
            "confidence": "low",
            "remedy_price": None,
            "remedy_link": None,
            "diagnosis_text": "",
            "diagnosis_translated": "",
            "audio_url": None,
            "error": None,
        }

        # ── Step 1: Vision Inference ──
        try:
            diagnosis = await self._vision_inference(image_base64, user_query)
            if diagnosis:
                result.update(diagnosis)
                logger.info(f"[Vision] Diagnosis: {diagnosis.get('issue_detected', 'unknown')}")
            else:
                result["error"] = "Vision model could not analyze the image."
                return result
        except Exception as e:
            logger.error(f"[Vision] Inference failed: {e}")
            result["error"] = f"Image analysis failed: {str(e)}"
            return result

        # ── Step 2: Price Search (skip if healthy or not a plant) ──
        if result["issue_detected"] not in ("healthy", "not_a_plant", "N/A"):
            try:
                if location:
                    logger.info(f"[Vision] Using location for search: {location}")

                price_info = await self._search_remedy_price(
                    result.get("search_query_trigger", ""),
                    result.get("recommended_material", ""),
                    location=location
                )
                if price_info:
                    result["remedy_price"] = price_info.get("price")
                    result["remedy_link"] = price_info.get("link")
            except Exception as e:
                logger.warning(f"[Vision] Price search failed: {e}")
                # Non-critical — continue without price

        # ── Step 3: Build diagnosis text and translate ──
        diagnosis_text = self._build_diagnosis_text(result)
        result["diagnosis_text"] = diagnosis_text

        if language != "en":
            try:
                # First try translation of all fields using Gemini
                await self._translate_fields(result, language)
            except Exception as e:
                logger.warning(f"[Vision] Gemini translation failed: {e}")

            if not result.get("diagnosis_translated") or result.get("diagnosis_translated") == diagnosis_text:
                try:
                    import asyncio
                    from app.services.translator import translator
                    translated = await asyncio.to_thread(
                        translator.translate_from_english, diagnosis_text, language
                    )
                    result["diagnosis_translated"] = translated if translated else diagnosis_text
                except Exception as fallback_err:
                    logger.warning(f"[Vision] Fallback translation failed: {fallback_err}")
                    result["diagnosis_translated"] = diagnosis_text
        else:
            result["diagnosis_translated"] = diagnosis_text

        # ── Step 4: TTS (speak the diagnosis aloud) ──
        if speak_result:
            try:
                from app.services.azure_tts_engine import casual_voice_engine
                import asyncio
                tts_text = result["diagnosis_translated"]
                audio_bytes = await asyncio.to_thread(
                    casual_voice_engine.speak_natural, tts_text, language
                )
                if audio_bytes:
                    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
                    mime = "audio/wav"
                    result["audio_url"] = f"data:{mime};base64,{audio_b64}"
                    logger.info(f"[Vision] TTS: {len(audio_bytes)} bytes")
            except Exception as e:
                logger.warning(f"[Vision] TTS failed: {e}")
                # Non-critical — continue without audio

        return result

    # ═══════════════════════════════════════════════════════════════════════
    # STEP 1: Vision Inference — NIM (primary) → Gemini (fallback)
    # ═══════════════════════════════════════════════════════════════════════

    async def _vision_inference(
        self, image_base64: str, user_query: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Run vision inference with tiered fallback."""

        # Tier 1: NVIDIA NIM
        if self._nim_available:
            try:
                result = await self._nim_vision(image_base64, user_query)
                if result:
                    return result
            except Exception as e:
                logger.warning(f"[Vision/NIM] Failed: {e}. Falling back to Gemini.")

        # Tier 2: Gemini multimodal
        if self._gemini_available:
            try:
                result = await self._gemini_vision(image_base64, user_query)
                if result:
                    return result
            except Exception as e:
                logger.error(f"[Vision/Gemini] Failed: {e}")

        return None

    async def _nim_vision(
        self, image_base64: str, user_query: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Call NVIDIA NIM nemotron-nano-12b-v2-vl."""
        user_content = []

        # Add image
        user_content.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:image/jpeg;base64,{image_base64}"
            }
        })

        # Add text prompt
        text_prompt = "Analyze this crop/plant image and diagnose any disease or issue."
        if user_query:
            text_prompt += f" The farmer's question: {user_query}"
        user_content.append({"type": "text", "text": text_prompt})

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                NVIDIA_NIM_VISION_URL,
                headers={
                    "Authorization": f"Bearer {NVIDIA_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": NVIDIA_VISION_MODEL,
                    "messages": [
                        {"role": "system", "content": VISION_SYSTEM_PROMPT},
                        {"role": "user", "content": user_content},
                    ],
                    "temperature": 1,
                    "top_p": 1,
                    "frequency_penalty": 0,
                    "presence_penalty": 0,
                    "max_tokens": 4096,
                },
            )

            if response.status_code != 200:
                raise Exception(f"NIM Vision {response.status_code}: {response.text[:300]}")

            data = response.json()
            content = data["choices"][0]["message"]["content"]
            return self._parse_json_response(content)

    async def _gemini_vision(
        self, image_base64: str, user_query: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Fallback: Call Gemini 2.5 Flash with image for vision inference."""
        text_prompt = VISION_SYSTEM_PROMPT + "\n\nAnalyze this crop/plant image."
        if user_query:
            text_prompt += f" The farmer asks: {user_query}"

        payload = {
            "contents": [{
                "parts": [
                    {
                        "inline_data": {
                            "mime_type": "image/jpeg",
                            "data": image_base64
                        }
                    },
                    {"text": text_prompt}
                ]
            }]
        }

        async with httpx.AsyncClient(timeout=45.0) as client:
            url = get_gemini_url()
            response = await client.post(
                url,
                headers={"Content-Type": "application/json"},
                json=payload,
            )

            if response.status_code != 200:
                raise Exception(f"Gemini Vision {response.status_code}: {response.text[:300]}")

            data = response.json()
            content = data["candidates"][0]["content"]["parts"][0]["text"]
            return self._parse_json_response(content)

    # ═══════════════════════════════════════════════════════════════════════
    # STEP 2: Remedy Price Search — Tavily (primary) → Gemini (fallback)
    # ═══════════════════════════════════════════════════════════════════════

    async def _search_remedy_price(
        self, search_query: str, material_name: str, location: Optional[str] = None
    ) -> Optional[Dict[str, str]]:
        """Search for remedy pricing with tiered fallback."""
        if not search_query and not material_name:
            return None

        query = search_query or f"{material_name} price India buy online"

        # Helper to execute the search logic
        async def execute_search(q: str):
            if self._tavily_available:
                try:
                    result = await self._tavily_search(q)
                    if result:
                        return result
                except Exception as e:
                    logger.warning(f"[Vision/Tavily] Failed: {e}. Falling back to Gemini Search.")

            if self._gemini_available:
                try:
                    result = await self._gemini_search(q, material_name)
                    if result:
                        return result
                except Exception as e:
                    logger.warning(f"[Vision/Gemini Search] Failed: {e}")
            return None

        # Tier 1: Localized Search
        if location:
            local_query = f"{query} in {location}"
            logger.info(f"[Vision] Searching local price: {local_query}")
            local_result = await execute_search(local_query)
            if local_result and local_result.get("price"):
                return local_result
            
            logger.info(f"[Vision] Local search failed to find price. Falling back to general search: {query}")

        # Tier 2: General/Normal Search
        return await execute_search(query)

    async def _tavily_search(self, query: str) -> Optional[Dict[str, str]]:
        """Search using Tavily API for remedy pricing."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": TAVILY_API_KEY,
                    "query": query,
                    "search_depth": "basic",
                    "include_domains": [
                        "amazon.in", "flipkart.com", "bighaat.com",
                        "agribegri.com", "indiamart.com", "kisaanhub.com"
                    ],
                    "max_results": 5,
                },
            )

            if response.status_code != 200:
                raise Exception(f"Tavily {response.status_code}: {response.text[:200]}")

            data = response.json()
            results = data.get("results", [])

            if not results:
                return None

            # Extract best price from results
            return self._extract_price_from_search(results)

    async def _gemini_search(
        self, query: str, material_name: str
    ) -> Optional[Dict[str, str]]:
        """Fallback: Use Gemini with Google Search grounding for pricing."""
        prompt = (
            f"Find the current price of '{material_name}' for agricultural use in India. "
            f"Search query: {query}\n\n"
            "Respond ONLY with a JSON object: "
            '{"price": "₹XXX for Yg/Yml", "link": "https://...", "source": "site name"}\n'
            "If no price found, respond: {\"price\": null, \"link\": null, \"source\": null}"
        )

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "tools": [{"google_search": {}}],
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            url = get_gemini_url()
            response = await client.post(
                url,
                headers={"Content-Type": "application/json"},
                json=payload,
            )

            if response.status_code != 200:
                raise Exception(f"Gemini Search {response.status_code}")

            data = response.json()
            content = data["candidates"][0]["content"]["parts"][0]["text"]
            parsed = self._parse_json_response(content)
            if parsed and parsed.get("price"):
                return {"price": parsed["price"], "link": parsed.get("link", "")}

        return None

    async def _translate_fields(self, result: Dict[str, Any], language: str) -> Dict[str, Any]:
        """Translate all diagnosis fields into target language using Gemini."""
        if not self._gemini_available or language == "en":
            return result

        try:
            from app.services.gemini_service import LANGUAGE_NAMES
            lang_name = LANGUAGE_NAMES.get(language, language)

            # Fields to translate
            fields_to_translate = {
                "plant_name": result.get("plant_name", ""),
                "issue_detected": result.get("issue_detected", ""),
                "severity": result.get("severity", ""),
                "cause": result.get("cause", ""),
                "organic_alternative": result.get("organic_alternative", ""),
                "recommended_material": result.get("recommended_material", ""),
                "application_method": result.get("application_method", ""),
                "diagnosis_text": result.get("diagnosis_text", ""),
            }

            # Do not translate if they are N/A or healthy/not_a_plant
            # For issue_detected, if it's healthy or not_a_plant, we keep it as is so the frontend can check it
            original_issue = fields_to_translate["issue_detected"]
            if original_issue in ("healthy", "not_a_plant", "N/A"):
                fields_to_translate.pop("issue_detected")

            prompt = (
                f"You are an agricultural translation assistant. Translate the values of this JSON object into the language '{lang_name}' ({language}).\n"
                f"Requirements:\n"
                f"1. Return ONLY a valid JSON object with the exact same keys.\n"
                f"2. Do NOT translate technical scientific names or chemical names completely (e.g. keep 'Copper Oxychloride' recognizable, but transliterate or translate it into {lang_name} script/phonetics if it helps the farmer, e.g. for Tamil: 'காப்பர் ஆக்ஸிகுளோரைடு (Copper Oxychloride)' or similar, and same for scientific names like fungi/bacteria).\n"
                f"3. Translate standard terms (like 'mild', 'moderate', 'severe' for severity, and agricultural action verbs) fully into natural '{lang_name}'.\n"
                f"4. Do not include any markdown backticks or explanations. Just return raw JSON.\n\n"
                f"JSON to translate:\n"
                f"{json.dumps(fields_to_translate, ensure_ascii=False)}"
            )

            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
            }
            async with httpx.AsyncClient(timeout=30.0) as client:
                url = get_gemini_url()
                response = await client.post(
                    url,
                    headers={"Content-Type": "application/json"},
                    json=payload,
                )
                if response.status_code == 200:
                    data = response.json()
                    content = data["candidates"][0]["content"]["parts"][0]["text"]
                    translated_fields = self._parse_json_response(content)
                    if translated_fields:
                        for k, v in translated_fields.items():
                            if v and v != "N/A":
                                result[k] = v
                        # Also write diagnosis_translated
                        if "diagnosis_text" in translated_fields:
                            result["diagnosis_translated"] = translated_fields["diagnosis_text"]
        except Exception as e:
            logger.warning(f"[Vision] Gemini translation failed: {e}")

        return result

    # ═══════════════════════════════════════════════════════════════════════
    # Utilities
    # ═══════════════════════════════════════════════════════════════════════

    @staticmethod
    def _parse_json_response(text: str) -> Optional[Dict[str, Any]]:
        """Extract and parse JSON from model response, handling markdown fencing."""
        # Strip markdown code fencing if present
        text = text.strip()
        if text.startswith("```"):
            # Remove ```json ... ``` or ``` ... ```
            text = re.sub(r"^```(?:json)?\s*\n?", "", text)
            text = re.sub(r"\n?```\s*$", "", text)

        # Try direct parse
        try:
            return json.loads(text.strip())
        except json.JSONDecodeError:
            pass

        # Try extracting JSON object from mixed text
        json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', text, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group(0))
            except json.JSONDecodeError:
                pass

        logger.warning(f"[Vision] Could not parse JSON from response: {text[:200]}")
        return None


    @staticmethod
    def _extract_price_from_search(results: list) -> Optional[Dict[str, str]]:
        """Extract price information from Tavily search results."""
        for result in results:
            content = result.get("content", "")
            url = result.get("url", "")

            # Look for Indian Rupee price patterns
            price_patterns = [
                r'₹\s*[\d,]+(?:\.\d{2})?',           # ₹250 or ₹1,250.00
                r'Rs\.?\s*[\d,]+(?:\.\d{2})?',        # Rs.250 or Rs 1,250
                r'INR\s*[\d,]+(?:\.\d{2})?',          # INR 250
                r'(?:Price|MRP)[:\s]*₹?\s*[\d,]+',    # Price: 250
            ]

            for pattern in price_patterns:
                match = re.search(pattern, content, re.IGNORECASE)
                if match:
                    return {
                        "price": match.group(0).strip(),
                        "link": url,
                    }

        # If no explicit price found, return first result link
        if results:
            return {
                "price": "Check link for current price",
                "link": results[0].get("url", ""),
            }

        return None

    @staticmethod
    def _build_diagnosis_text(result: Dict[str, Any]) -> str:
        """Build a farmer-friendly diagnosis summary in English."""
        issue = result.get("issue_detected", "unknown")

        if issue == "not_a_plant":
            return "This image does not appear to show a plant or crop. Please take a clear photo of the affected plant."

        if issue == "healthy":
            plant = result.get("plant_name", "Your plant")
            return f"Good news! Your {plant} looks healthy. No disease or deficiency detected. Keep up the good work!"

        plant = result.get("plant_name", "crop")
        cause = result.get("cause", "unknown cause")
        severity = result.get("severity", "")
        organic = result.get("organic_alternative", "")
        chemical = result.get("recommended_material", "")
        method = result.get("application_method", "")
        price = result.get("remedy_price")

        text = f"Your {plant} has {issue}, caused by {cause}."

        if severity:
            text += f" Severity is {severity}."

        if organic and organic != "N/A":
            text += f" First try this natural remedy: {organic}."

        if chemical and chemical not in ("N/A", "none_needed"):
            text += f" If needed, use {chemical}."

        if method and method != "N/A":
            text += f" {method}."

        if price and price != "Check link for current price":
            text += f" Estimated price: {price}."

        return text


# ── Singleton ──
vision_diagnostic_service = VisionDiagnosticService()
