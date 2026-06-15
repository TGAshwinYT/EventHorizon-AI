"""
HarvestIQ Router — EventHorizon AI
====================================
Clean REST API for agricultural risk assessment.
Endpoints: assess, crops, locations, advisory/sms, health.
"""

import os
import httpx
import asyncio
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel

from app.cache_utils import TTLCache
from app.services.risk_assessment_service import compute_risk_assessment, CROP_PROFILES
from app.services.india_locations import (
    get_location_tree,
    find_nearest_district,
    get_coords_for_district,
)
from app.services.gemini_service import gemini_service
from app.services.satellite_ndvi_service import get_ndvi_analysis
from app.services.irrigation_service import generate_irrigation_schedule

router = APIRouter(prefix="/api/harvestiq", tags=["HarvestIQ"])

# ──────────────────────────────────────────────────────────────
# Caches
# ──────────────────────────────────────────────────────────────
_risk_cache = TTLCache(ttl_seconds=1800)   # 30-min for risk assessment
_ip_cache   = TTLCache(ttl_seconds=86400)  # 24-hr  for IP geolocation
_sms_cache  = TTLCache(ttl_seconds=3600)   # 1-hr   for SMS advisory

# ──────────────────────────────────────────────────────────────
# Extended Crop Metadata (icons, stages, water needs)
# ──────────────────────────────────────────────────────────────
CROP_META = {
    "Rice":        {"icon": "🌾", "growth_stages": ["Seedling", "Tillering", "Flowering", "Grain Filling", "Maturity"], "water_need_mm_week": 50, "optimal_temp_range": [20, 35]},
    "Wheat":       {"icon": "🌿", "growth_stages": ["Germination", "Tillering", "Booting", "Heading", "Maturity"], "water_need_mm_week": 30, "optimal_temp_range": [10, 25]},
    "Cotton":      {"icon": "☁️", "growth_stages": ["Seedling", "Squaring", "Flowering", "Boll Formation", "Maturity"], "water_need_mm_week": 35, "optimal_temp_range": [21, 35]},
    "Tomato":      {"icon": "🍅", "growth_stages": ["Seedling", "Vegetative", "Flowering", "Fruiting", "Harvest"], "water_need_mm_week": 25, "optimal_temp_range": [18, 30]},
    "Onion":       {"icon": "🧅", "growth_stages": ["Seedling", "Vegetative", "Bulb Formation", "Maturity", "Harvest"], "water_need_mm_week": 20, "optimal_temp_range": [13, 28]},
    "Potato":      {"icon": "🥔", "growth_stages": ["Sprout", "Vegetative", "Tuber Initiation", "Tuber Bulking", "Maturity"], "water_need_mm_week": 25, "optimal_temp_range": [15, 25]},
    "Sugarcane":   {"icon": "🎋", "growth_stages": ["Germination", "Tillering", "Grand Growth", "Maturity", "Harvest"], "water_need_mm_week": 45, "optimal_temp_range": [20, 38]},
    "Maize":       {"icon": "🌽", "growth_stages": ["Seedling", "Vegetative", "Tasseling", "Grain Filling", "Maturity"], "water_need_mm_week": 30, "optimal_temp_range": [18, 33]},
    "Brinjal":     {"icon": "🍆", "growth_stages": ["Seedling", "Vegetative", "Flowering", "Fruiting", "Harvest"], "water_need_mm_week": 22, "optimal_temp_range": [20, 32]},
    "Cabbage":     {"icon": "🥬", "growth_stages": ["Seedling", "Rosette", "Heading", "Maturity", "Harvest"], "water_need_mm_week": 25, "optimal_temp_range": [15, 25]},
    "Cauliflower": {"icon": "🥦", "growth_stages": ["Seedling", "Vegetative", "Curd Formation", "Maturity", "Harvest"], "water_need_mm_week": 25, "optimal_temp_range": [15, 22]},
    "Mango":       {"icon": "🥭", "growth_stages": ["Dormancy", "Flowering", "Fruit Set", "Fruit Development", "Harvest"], "water_need_mm_week": 20, "optimal_temp_range": [24, 38]},
    "Banana":      {"icon": "🍌", "growth_stages": ["Sucker", "Vegetative", "Flowering", "Bunch Development", "Harvest"], "water_need_mm_week": 40, "optimal_temp_range": [20, 35]},
    "Apple":       {"icon": "🍎", "growth_stages": ["Dormancy", "Bud Break", "Flowering", "Fruit Development", "Harvest"], "water_need_mm_week": 20, "optimal_temp_range": [10, 25]},
}

# Language names for SMS
LANG_NAMES = {
    "en": "English", "hi": "Hindi", "ta": "Tamil", "te": "Telugu",
    "bn": "Bengali", "mr": "Marathi", "gu": "Gujarati", "kn": "Kannada",
    "ml": "Malayalam", "pa": "Punjabi",
}


# ──────────────────────────────────────────────────────────────
# Request Models
# ──────────────────────────────────────────────────────────────

class AssessRequest(BaseModel):
    crop_name: str
    growth_stage: str = "Vegetative"
    lat: Optional[float] = None
    lon: Optional[float] = None
    state: Optional[str] = None
    district: Optional[str] = None
    place: Optional[str] = None
    lang: str = "en"


# ──────────────────────────────────────────────────────────────
# Helper: Resolve location
# ──────────────────────────────────────────────────────────────

def _get_client_ip(request: Request) -> Optional[str]:
    """Extract real client IP, handling proxies."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


async def _resolve_location_from_ip(ip: str, client: httpx.AsyncClient) -> Optional[dict]:
    """IP geolocation via ip-api.com (free, no key)."""
    if not ip or ip in ("127.0.0.1", "::1", "localhost"):
        return None

    cached = _ip_cache.get(f"ip_{ip}")
    if cached:
        return cached

    try:
        res = await client.get(
            f"http://ip-api.com/json/{ip}?fields=status,city,regionName,lat,lon",
            timeout=5,
        )
        if res.status_code == 200:
            data = res.json()
            if data.get("status") == "success":
                nearest = find_nearest_district(data["lat"], data["lon"])
                if nearest:
                    result = {
                        "state": nearest["state"],
                        "district": nearest["district"],
                        "lat": nearest["lat"],
                        "lon": nearest["lon"],
                        "method": "ip",
                    }
                    _ip_cache.set(f"ip_{ip}", result)
                    return result
    except Exception as e:
        print(f"[HarvestIQ] IP geolocation failed: {e}")
    return None


async def _resolve_location(
    lat: Optional[float],
    lon: Optional[float],
    state: Optional[str],
    district: Optional[str],
    place: Optional[str],
    request: Request,
    client: httpx.AsyncClient,
) -> dict:
    """
    4-layer location resolution:
      Layer 0: Manual state/district/place
      Layer 1: GPS coords
      Layer 2: IP geolocation
      Layer 3: error
    """
    # Layer 0: Manual
    if state and district:
        from app.services.geocoding import get_coords_with_place
        lat_res, lon_res = await get_coords_with_place(state, district, place or "", client)
        return {
            "state": state,
            "district": district,
            "place": place or "",
            "lat": lat_res,
            "lon": lon_res,
            "method": "manual"
        }

    # Layer 1: GPS
    if lat is not None and lon is not None:
        nearest = find_nearest_district(lat, lon)
        if nearest:
            return {**nearest, "method": "gps"}
        return {"state": "Unknown", "district": "Unknown", "lat": lat, "lon": lon, "method": "gps"}

    # Layer 2: IP
    ip = _get_client_ip(request)
    if ip:
        result = await _resolve_location_from_ip(ip, client)
        if result:
            return result

    # Layer 3: Manual fallback needed
    raise HTTPException(
        status_code=400,
        detail="Could not auto-detect location. Please provide lat/lon or use manual selection.",
        headers={"X-HarvestIQ-Code": "LOCATION_REQUIRED"},
    )


# ──────────────────────────────────────────────────────────────
# 1. POST /assess — Main Risk Assessment
# ──────────────────────────────────────────────────────────────

@router.post("/assess")
async def assess_crop_risk(body: AssessRequest, request: Request):
    """Primary endpoint: compute full risk matrix for a crop + location."""

    # Validate crop
    crop = body.crop_name.strip()
    matched_crop = None
    for known in CROP_PROFILES:
        if known.lower() == crop.lower():
            matched_crop = known
            break

    if not matched_crop:
        raise HTTPException(
            status_code=404,
            detail=f"Crop '{crop}' not found. Use GET /api/harvestiq/crops for available crops.",
        )

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Resolve location
        location = await _resolve_location(body.lat, body.lon, body.state, body.district, body.place, request, client)

        # Cache check
        cache_key = f"hiq_{matched_crop}_{location['lat']}_{location['lon']}"
        cached = _risk_cache.get(cache_key)
        if cached:
            return cached

        # Get API key
        api_key = os.getenv("OPENWEATHERMAP_API_KEY")
        if not api_key:
            raise HTTPException(status_code=503, detail="Weather service unavailable: API key not configured.")

        # Get coordinates resolved from location
        final_lat = location["lat"]
        final_lon = location["lon"]

        place_name = location.get("place", "")
        if place_name:
            location_label = f"{place_name}, {location['district']}, {location['state']}"
        else:
            location_label = f"{location['district']}, {location['state']}"

        # Concurrently fetch weather risk assessment and NDVI data
        try:
            risk_task = compute_risk_assessment(
                lat=final_lat,
                lon=final_lon,
                crop=matched_crop,
                location_label=location_label,
                api_key=api_key,
                client=client,
            )
            ndvi_task = get_ndvi_analysis(final_lat, final_lon, periods=6, client=client)

            risk_res, ndvi_res = await asyncio.gather(risk_task, ndvi_task, return_exceptions=True)

            # Check for weather service/risk assessment error
            if isinstance(risk_res, Exception):
                raise HTTPException(status_code=503, detail=f"Weather service error: {str(risk_res)}")
            
            result = risk_res

            # Check for satellite/NDVI error
            if isinstance(ndvi_res, Exception):
                print(f"[HarvestIQ] NDVI error: {ndvi_res}")
                ndvi_data = None
            else:
                ndvi_data = ndvi_res

            result["satellite"] = ndvi_data

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"Risk assessment compilation failed: {str(e)}")

        # Enrich with growth stage + metadata
        meta = CROP_META.get(matched_crop, {})
        result["growth_stage"] = body.growth_stage
        result["crop_icon"] = meta.get("icon", "🌱")
        result["location_method"] = location["method"]

    # Phase 3: Irrigation Schedule
    try:
        base_water = meta.get("water_need_mm_week", 25)
        
        # Use real forecast from the weather service if available, else fallback
        forecast = result.get("weather_forecast")
        if forecast:
            import datetime
            # Pad to 7 days if the 5-day weather API returns fewer days
            while len(forecast) < 7:
                last_date_str = forecast[-1]["date"]
                try:
                    last_date = datetime.datetime.strptime(last_date_str, "%Y-%m-%d")
                except ValueError:
                    last_date = datetime.datetime.now()
                next_date = last_date + datetime.timedelta(days=1)
                forecast.append({
                    "date": next_date.strftime("%Y-%m-%d"),
                    "day_name": next_date.strftime("%A"),
                    "rain_mm": 0.0,
                    "pop": 0.0
                })
        else:
            import datetime
            forecast = [
                {
                    "date": (datetime.datetime.now() + datetime.timedelta(days=i)).strftime("%Y-%m-%d"),
                    "day_name": (datetime.datetime.now() + datetime.timedelta(days=i)).strftime("%A"),
                    "rain_mm": 0.0,
                    "pop": 0.0
                } for i in range(7)
            ]
        
        irrigation_data = generate_irrigation_schedule(
            crop_name=matched_crop,
            growth_stage=body.growth_stage,
            base_water_need_mm_week=base_water,
            weather_forecast=forecast,
            ndvi_data=ndvi_data
        )
        result["irrigation"] = irrigation_data
    except Exception as e:
        print(f"[HarvestIQ] Irrigation error: {e}")
        irrigation_data = None
        result["irrigation"] = None

    # Phase 4: Multilingual AI Advisory
    try:
        lang_name = LANG_NAMES.get(body.lang, "English")
        drought = result["risks"]["drought"]
        pest = result["risks"]["pest"]
        
        prompt = (
            f"You are an expert agricultural AI. Write a SHORT, SINGLE paragraph advisory (max 4 sentences) in {lang_name} for {matched_crop} farmers in {location_label}.\n"
            f"Conditions: Drought risk is {drought['label']} ({drought['score']}/100). Pest risk is {pest['label']} ({pest['score']}/100).\n"
        )
        if ndvi_data and ndvi_data.get("trend"):
            prompt += f"Vegetation health trend is {ndvi_data['trend'].get('direction', 'stable')}. "
        if irrigation_data:
            prompt += f"Water target is {irrigation_data.get('weekly_target_mm', 0)}mm this week.\n"
            
        prompt += "Give practical, immediate advice. NO formatting, just plain text."
        
        advisory_text = await asyncio.to_thread(
            gemini_service.generate_response,
            prompt,
            context="agriculture",
            detected_language=body.lang
        )
        result["ai_advisory"] = advisory_text
    except Exception as e:
        print(f"[HarvestIQ] AI Advisory error: {e}")
        result["ai_advisory"] = "Advisory unavailable at this moment."

    _risk_cache.set(cache_key, result)
    return result


# ──────────────────────────────────────────────────────────────
# 2. GET /crops — Crop List
# ──────────────────────────────────────────────────────────────

@router.get("/crops")
async def get_crops():
    """Return all available crops with metadata for the selector dropdown."""
    crops = []
    for name, sensitivity in CROP_PROFILES.items():
        meta = CROP_META.get(name, {})
        crops.append({
            "name": name,
            "icon": meta.get("icon", "🌱"),
            "growth_stages": meta.get("growth_stages", ["Seedling", "Vegetative", "Flowering", "Fruiting", "Harvest"]),
            "water_need_mm_week": meta.get("water_need_mm_week", 25),
            "optimal_temp_range": meta.get("optimal_temp_range", [15, 35]),
            "sensitivity": sensitivity,
        })
    return {"crops": sorted(crops, key=lambda c: c["name"])}


# ──────────────────────────────────────────────────────────────
# 3. GET /locations — India Location Tree
# ──────────────────────────────────────────────────────────────

@router.get("/locations")
async def get_locations():
    """Return the full India state → district tree for the manual fallback dropdown."""
    return get_location_tree()


@router.get("/detect-location")
async def detect_location(request: Request):
    """Auto-detect location from IP."""
    ip = _get_client_ip(request)
    if not ip:
        raise HTTPException(status_code=400, detail="Could not determine IP address")

    async with httpx.AsyncClient(timeout=10.0) as client:
        result = await _resolve_location_from_ip(ip, client)
        if result:
            return result

    raise HTTPException(
        status_code=404,
        detail="Could not detect location from IP. Use GPS or manual selection."
    )


@router.get("/resolve-gps")
async def resolve_gps(lat: float, lon: float):
    """Resolve lat/lon to the nearest district and state in the India database."""
    nearest = find_nearest_district(lat, lon)
    if nearest:
        return nearest
    raise HTTPException(
        status_code=404,
        detail="No matching district found for these coordinates."
    )



# ──────────────────────────────────────────────────────────────
# 4. GET /advisory/sms — SMS-Optimized Advisory
# ──────────────────────────────────────────────────────────────

@router.get("/advisory/sms")
async def get_sms_advisory(
    crop: str = Query(..., description="Crop name"),
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude"),
    lang: str = Query("en", description="Language code (en, hi, ta, te, bn, mr, gu, kn, ml, pa)"),
):
    """
    Generate a compressed SMS advisory (<160 chars) from the risk assessment.
    Uses Gemini to compress and translate.
    """
    # Cache check
    cache_key = f"sms_{crop.lower()}_{lat}_{lon}_{lang}"
    cached = _sms_cache.get(cache_key)
    if cached:
        return cached

    # Validate crop
    matched_crop = None
    for known in CROP_PROFILES:
        if known.lower() == crop.lower():
            matched_crop = known
            break
    if not matched_crop:
        raise HTTPException(status_code=404, detail=f"Crop '{crop}' not found.")

    # Get risk assessment
    api_key = os.getenv("OPENWEATHERMAP_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="Weather service unavailable.")

    nearest = find_nearest_district(lat, lon)
    location_label = f"{nearest['district']}, {nearest['state']}" if nearest else f"{lat},{lon}"
    final_lat = nearest["lat"] if nearest else lat
    final_lon = nearest["lon"] if nearest else lon

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            risk_data = await compute_risk_assessment(
                lat=final_lat, lon=final_lon,
                crop=matched_crop,
                location_label=location_label,
                api_key=api_key,
                client=client,
            )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=f"Weather service error: {str(e)}")

    # Build context for Gemini compression
    lang_name = LANG_NAMES.get(lang, "English")
    drought = risk_data["risks"]["drought"]
    pest = risk_data["risks"]["pest"]
    flood = risk_data["risks"]["flood"]

    prompt = (
        f"You are an agricultural SMS advisory system. Compress this risk report into a SINGLE SMS "
        f"message of EXACTLY under 160 characters in {lang_name}. "
        f"Include the crop name, location, and the most critical risk only. "
        f"Use common abbreviations. No greetings, no sign-off.\n\n"
        f"RISK REPORT:\n"
        f"Crop: {matched_crop} at {location_label}\n"
        f"Drought: {drought['score']}/100 ({drought['label']}) — {drought['advisory']}\n"
        f"Pest: {pest['score']}/100 ({pest['label']}) — {pest['advisory']}\n"
        f"Flood: {flood['score']}/100 ({flood['label']}) — {flood['advisory']}\n\n"
        f"OUTPUT ONLY the SMS text, nothing else. Must be under 160 characters in {lang_name}."
    )

    sms_text = await asyncio.to_thread(
        gemini_service.generate_response,
        prompt,
        context="agriculture",
        detected_language=lang
    )

    # Enforce 160 char limit
    sms_text = sms_text.strip().replace('"', '').replace("'", "")
    if len(sms_text) > 160:
        sms_text = sms_text[:157] + "..."

    result = {
        "sms_text": sms_text,
        "char_count": len(sms_text),
        "language": lang,
        "crop": matched_crop,
        "location": location_label,
    }

    _sms_cache.set(cache_key, result)
    return result


# ──────────────────────────────────────────────────────────────
# 5. GET /health — Health Check
# ──────────────────────────────────────────────────────────────

@router.get("/health")
async def health_check():
    """Simple ping to confirm HarvestIQ module is live."""
    weather_key = bool(os.getenv("OPENWEATHERMAP_API_KEY"))
    gemini_key = bool(os.getenv("GEMINI_API_KEY"))

    return {
        "status": "operational",
        "service": "HarvestIQ Risk Engine",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "available_crops": len(CROP_PROFILES),
        "location_database": "336 districts, 33 states/UTs",
        "dependencies": {
            "weather_api": "configured" if weather_key else "missing",
            "gemini_api": "configured" if gemini_key else "missing",
        },
    }
