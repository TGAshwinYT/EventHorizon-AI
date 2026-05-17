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

from app.cache_utils import TTLCache

logger = logging.getLogger("eventhorizon.vision")

# Cache Geolocation for 24 hours to bypass repetitive O(Network) calls
ip_geo_cache = TTLCache(ttl_seconds=86400)

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
        self._nim_available = bool(NVIDIA_API_KEY)
        self._tavily_available = bool(TAVILY_API_KEY)
        self._gemini_available = bool(GEMINI_API_KEY)
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
        client_ip: Optional[str] = None,
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
                # Attempt to get location from IP
                location = await self._get_location_from_ip(client_ip) if client_ip else None
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
                from app.services.translator import translator
                translated = translator.translate_from_english(diagnosis_text, language)
                result["diagnosis_translated"] = translated if translated else diagnosis_text
            except Exception as e:
                logger.warning(f"[Vision] Translation failed: {e}")
                result["diagnosis_translated"] = diagnosis_text
        else:
            result["diagnosis_translated"] = diagnosis_text

        # ── Step 4: TTS (speak the diagnosis aloud) ──
        if speak_result:
            try:
                from app.services.riva_tts_service import riva_tts_service
                tts_text = result["diagnosis_translated"]
                audio_bytes = await riva_tts_service.synthesize(tts_text, language, "mp3")
                if audio_bytes:
                    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
                    result["audio_url"] = f"data:audio/mp3;base64,{audio_b64}"
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
    async def _get_location_from_ip(ip: str) -> Optional[str]:
        """Resolve IP address to a city and region using ip-api.com."""
        if not ip or ip in ("127.0.0.1", "localhost", "::1"):
            return None
            
        cached_loc = ip_geo_cache.get(ip)
        if cached_loc:
            return cached_loc

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"http://ip-api.com/json/{ip}?fields=status,city,regionName")
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("status") == "success":
                        city = data.get("city")
                        region = data.get("regionName")
                        loc_str = None
                        if city and region:
                            loc_str = f"{city}, {region}"
                        elif city:
                            loc_str = city
                            
                        if loc_str:
                            ip_geo_cache.set(ip, loc_str)
                            return loc_str
        except Exception as e:
            logger.warning(f"[Vision] IP Geolocation failed for {ip}: {e}")
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
