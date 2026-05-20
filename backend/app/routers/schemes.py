import json
import time
import threading
from fastapi import APIRouter, HTTPException
from app.models.schemas import StateSchemeRequest, SchemeExplainRequest, EligibilityCheckRequest
from app.services.gemini_service import gemini_service

router = APIRouter()

# ========== O(1) TTL Cache for State Schemes ==========
# Thread-safe dictionary cache with TTL (Time-To-Live) expiry.
# Key: (state, language) tuple → O(1) hash-map lookup
# Avoids redundant Gemini API calls for the same state+language combo.

class TTLCache:
    """Simple thread-safe TTL cache using a dict (O(1) lookup)."""
    def __init__(self, ttl_seconds: int = 3600):
        self._cache: dict = {}
        self._lock = threading.Lock()
        self.ttl = ttl_seconds

    def get(self, key: tuple):
        with self._lock:
            if key in self._cache:
                value, timestamp = self._cache[key]
                if time.time() - timestamp < self.ttl:
                    return value
                else:
                    del self._cache[key]
        return None

    def set(self, key: tuple, value):
        with self._lock:
            self._cache[key] = (value, time.time())

_state_scheme_cache = TTLCache(ttl_seconds=3600)  # 1 hour cache


@router.post('/state')
def get_state_schemes(data: StateSchemeRequest):
    """
    POST /api/schemes/state
    Generate 3-4 state-specific agricultural schemes using Gemini AI.
    Results are cached per (state, language) for 1 hour (O(1) lookup).
    """
    cache_key = (data.state.lower().strip(), data.language)
    cached = _state_scheme_cache.get(cache_key)
    if cached:
        print(f"[SCHEMES] Cache HIT for state={data.state}, lang={data.language}")
        return {"schemes": cached, "source": "cache"}

    print(f"[SCHEMES] Cache MISS for state={data.state}, lang={data.language}. Calling Gemini...")

    today = time.strftime('%Y-%m-%d')
    prompt = f"""You are an expert on Indian agricultural government schemes.
Generate exactly 4 real, currently active state-level agricultural schemes for the state of {data.state}, India.
{f'District: {data.district}.' if data.district else ''}

For each scheme, provide accurate information. Respond ONLY with a valid JSON array, no markdown fences.
Each object must have these exact keys:
- "id": a short kebab-case identifier
- "name": the scheme name in {data.language} language
- "details": 1-2 sentence description of the scheme in {data.language} language
- "eligibility": who can apply (in {data.language})
- "benefit": key financial benefit (in {data.language})
- "category": one of "Income Support", "Insurance", "Credit", "Market Access", "Irrigation", "Infrastructure", "Organic Farming", "Mechanisation", "Subsidy", "Training"
- "application_link": real official website URL if known, otherwise state agriculture dept URL
- "dateAdded": "{today}"

IMPORTANT: These must be REAL schemes that actually exist in {data.state}. Do not invent fake schemes.
Respond with ONLY the JSON array, nothing else."""

    try:
        response_text = gemini_service.generate_response(
            message=prompt,
            context="agriculture",
            detected_language=data.language
        )
        # Clean markdown fences if present
        cleaned = response_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]
        cleaned = cleaned.strip()

        schemes = json.loads(cleaned)
        if not isinstance(schemes, list):
            schemes = [schemes]

        # Cache the result
        _state_scheme_cache.set(cache_key, schemes)
        return {"schemes": schemes, "source": "generated"}
    except json.JSONDecodeError as e:
        print(f"[SCHEMES STATE ERROR] JSON parse failed: {e}")
        print(f"[SCHEMES STATE ERROR] Raw response: {response_text[:500]}")
        raise HTTPException(status_code=500, detail="Failed to parse AI-generated schemes. Please try again.")
    except Exception as e:
        print(f"[SCHEMES STATE ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/explain')
def explain_scheme(data: SchemeExplainRequest):
    """
    POST /api/schemes/explain
    Generate a detailed AI explanation of a government scheme.
    Returns structured JSON with target audience, documents, steps, and timeline.
    """
    prompt = f"""You are Horizon, a friendly agricultural advisor for Indian farmers.
Explain the following government scheme in simple, easy-to-understand language.

Scheme: {data.scheme_name}
Details: {data.scheme_details}

Your response MUST be in {data.language} language and formatted as a JSON object with these exact keys:
{{
  "target_audience": "Who this scheme is for (1-2 sentences)",
  "documents_needed": ["Document 1", "Document 2", "Document 3"],
  "steps_to_apply": ["Step 1: ...", "Step 2: ...", "Step 3: ...", "Step 4: ..."],
  "expected_timeline": "How long the process takes",
  "pro_tip": "One practical tip for the farmer"
}}

Respond with ONLY the JSON object, no markdown fences."""

    try:
        response_text = gemini_service.generate_response(
            message=prompt,
            context="agriculture",
            detected_language=data.language
        )
        cleaned = response_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]
        cleaned = cleaned.strip()

        result = json.loads(cleaned)
        return result
    except json.JSONDecodeError:
        return {
            "target_audience": "All farmers",
            "documents_needed": ["Aadhaar Card", "Land Records", "Bank Passbook"],
            "steps_to_apply": ["Visit the official portal", "Register with Aadhaar", "Fill the application form", "Submit documents"],
            "expected_timeline": "2-4 weeks",
            "pro_tip": "Contact your local CSC center for help with the application."
        }
    except Exception as e:
        print(f"[SCHEMES EXPLAIN ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post('/eligibility')
def check_eligibility(data: EligibilityCheckRequest):
    """
    POST /api/schemes/eligibility
    AI-powered eligibility check based on farmer's profile.
    """
    prompt = f"""You are an expert on Indian agricultural government schemes.
A farmer wants to check if they are eligible for the scheme: {data.scheme_name}

Farmer details:
- Land size: {data.land_size_acres} acres
- Social category: {data.social_category}
- Annual income: ₹{data.annual_income:,.0f}

Based on the general eligibility criteria of this scheme, evaluate whether this farmer is likely eligible.

Respond in {data.language} language as a JSON object with these exact keys:
{{
  "eligible": true or false,
  "confidence": "High" or "Medium" or "Low",
  "reason": "1-2 sentence explanation of why they are/aren't eligible",
  "suggestion": "What they should do next — if eligible, how to apply; if not, what alternative scheme to consider"
}}

Respond with ONLY the JSON object, no markdown fences."""

    try:
        response_text = gemini_service.generate_response(
            message=prompt,
            context="agriculture",
            detected_language=data.language
        )
        cleaned = response_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]
        cleaned = cleaned.strip()

        result = json.loads(cleaned)
        return result
    except json.JSONDecodeError:
        return {
            "eligible": True,
            "confidence": "Low",
            "reason": "Unable to verify automatically. Please check the official portal.",
            "suggestion": "Visit your nearest CSC center or Krishi Vigyan Kendra for eligibility verification."
        }
    except Exception as e:
        print(f"[SCHEMES ELIGIBILITY ERROR] {e}")
        raise HTTPException(status_code=500, detail=str(e))
