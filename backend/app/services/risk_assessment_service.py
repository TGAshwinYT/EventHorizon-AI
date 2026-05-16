"""
Risk Assessment Service — EventHorizon AI
==========================================
Computes weekly agricultural risk scores (drought, pest, flood) using
weather forecast data from OpenWeatherMap. Purely algorithmic — no new
external API required.

Each risk is scored 0–100 and labelled: Low / Moderate / High / Critical.
Crop-specific sensitivity multipliers adjust raw weather-derived scores.
"""

import os
import requests
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List

# ---------------------------------------------------------------------------
# Crop Sensitivity Profiles
# ---------------------------------------------------------------------------
# Each value is a multiplier (0.0 – 1.5) representing how sensitive
# the crop is to that particular risk.  >1.0 = amplifies risk, <1.0 = dampens.

CROP_PROFILES: Dict[str, Dict[str, float]] = {
    "Rice":       {"drought": 0.6,  "pest": 0.9,  "flood": 0.3},   # flood-tolerant paddy
    "Wheat":      {"drought": 1.0,  "pest": 0.7,  "flood": 1.0},
    "Cotton":     {"drought": 0.8,  "pest": 1.3,  "flood": 1.1},   # very pest-prone
    "Tomato":     {"drought": 1.1,  "pest": 1.2,  "flood": 1.2},
    "Onion":      {"drought": 0.9,  "pest": 0.8,  "flood": 1.3},   # rots easily
    "Potato":     {"drought": 1.0,  "pest": 1.1,  "flood": 1.2},
    "Sugarcane":  {"drought": 1.2,  "pest": 0.7,  "flood": 0.5},   # water-loving
    "Maize":      {"drought": 1.1,  "pest": 1.0,  "flood": 1.0},
    "Brinjal":    {"drought": 1.0,  "pest": 1.3,  "flood": 1.1},
    "Cabbage":    {"drought": 0.9,  "pest": 1.2,  "flood": 1.0},
    "Cauliflower":{"drought": 0.9,  "pest": 1.2,  "flood": 1.0},
    "Mango":      {"drought": 0.7,  "pest": 1.1,  "flood": 0.8},
    "Banana":     {"drought": 1.3,  "pest": 0.9,  "flood": 0.6},
    "Apple":      {"drought": 0.8,  "pest": 1.0,  "flood": 1.0},
}

DEFAULT_SENSITIVITY = {"drought": 1.0, "pest": 1.0, "flood": 1.0}


def _label(score: float) -> str:
    """Convert numeric score to severity label."""
    if score < 25:
        return "Low"
    elif score < 50:
        return "Moderate"
    elif score < 75:
        return "High"
    return "Critical"


def _clamp(val: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, val))


# ---------------------------------------------------------------------------
# Core Scoring Functions
# ---------------------------------------------------------------------------

def _compute_drought_score(day_data: Dict[str, Any]) -> float:
    """
    Drought risk rises with:
      • High temperature (>35 °C accelerates drying)
      • Low rain probability (<20 % = dry spell)
      • Low humidity (<40 % = arid air)
    """
    temp_max = day_data["temp_max"]
    rain_prob = day_data["avg_pop"]   # 0 – 100
    humidity  = day_data["avg_humidity"]

    # Temperature contribution (0–40 pts): ramps up above 30 °C
    temp_score = _clamp((temp_max - 28) * 5, 0, 40)

    # Inverse rain contribution (0–35 pts): lower rain → higher drought
    rain_score = _clamp((100 - rain_prob) * 0.35, 0, 35)

    # Inverse humidity contribution (0–25 pts)
    humidity_score = _clamp((80 - humidity) * 0.5, 0, 25)

    return _clamp(temp_score + rain_score + humidity_score)


def _compute_pest_score(day_data: Dict[str, Any]) -> float:
    """
    Pest risk peaks in the 'Goldilocks zone':
      • Moderate temperature (22–32 °C)
      • High humidity (>65 %)
      • Low wind speed (<12 km/h — pests can't fly in wind)
    """
    temp_max = day_data["temp_max"]
    humidity = day_data["avg_humidity"]
    wind     = day_data["avg_wind_speed"]

    # Temp in sweet spot 22–32 → high pest risk (0–35 pts)
    if 22 <= temp_max <= 32:
        temp_score = 35
    elif 18 <= temp_max < 22 or 32 < temp_max <= 38:
        temp_score = 18
    else:
        temp_score = 5

    # High humidity contribution (0–40 pts)
    humidity_score = _clamp((humidity - 40) * 1.0, 0, 40)

    # Low wind contribution (0–25 pts) — calm air is bad
    wind_score = _clamp((20 - wind) * 1.5, 0, 25)

    return _clamp(temp_score + humidity_score + wind_score)


def _compute_flood_score(day_data: Dict[str, Any]) -> float:
    """
    Flood risk rises with:
      • High rain probability (>50 %)
      • Low atmospheric pressure (<1005 hPa — cyclone / depression)
      • High sustained wind (storm proxy)
    """
    rain_prob = day_data["avg_pop"]         # 0–100
    pressure  = day_data["avg_pressure"]    # hPa
    wind      = day_data["avg_wind_speed"]  # km/h

    # Rain contribution (0–50 pts)
    rain_score = _clamp(rain_prob * 0.5, 0, 50)

    # Low pressure contribution (0–30 pts): below 1010 hPa is concerning
    pressure_score = _clamp((1015 - pressure) * 1.5, 0, 30)

    # High wind contribution (0–20 pts)
    wind_score = _clamp((wind - 10) * 1.0, 0, 20)

    return _clamp(rain_score + pressure_score + wind_score)


# ---------------------------------------------------------------------------
# Advisory Text Generator
# ---------------------------------------------------------------------------

def _generate_advisory(risk_type: str, score: float, day_data: Dict[str, Any], crop: str) -> str:
    """Generate human-readable advisory for a risk type."""
    label = _label(score)

    if risk_type == "drought":
        if label == "Low":
            return f"Soil moisture levels look adequate for {crop}. Continue regular irrigation schedule."
        elif label == "Moderate":
            return f"Moderate drought stress possible. Consider increasing irrigation frequency for {crop} and applying mulch to retain soil moisture."
        elif label == "High":
            return f"High drought risk detected. Immediately increase irrigation for {crop}. Avoid transplanting young seedlings. Apply organic mulch and consider shade nets."
        else:
            return f"CRITICAL: Severe drought conditions expected. Emergency irrigation needed for {crop}. Postpone all planting. Prioritize water conservation — drip irrigation recommended."

    elif risk_type == "pest":
        if label == "Low":
            return f"Low pest pressure expected. Maintain routine scouting for {crop} fields."
        elif label == "Moderate":
            return f"Moderate pest risk — warm, humid conditions favour insect activity. Increase scouting frequency for {crop}. Consider neem-based organic sprays as preventive."
        elif label == "High":
            return f"High pest risk: temperature and humidity in the danger zone for {crop}. Deploy pheromone traps, apply bio-pesticides, and inspect undersides of leaves daily."
        else:
            return f"CRITICAL pest outbreak conditions for {crop}. Immediate integrated pest management needed. Consult your local agricultural officer. Avoid broad-spectrum chemicals — use targeted bio-controls."

    else:  # flood
        if label == "Low":
            return f"Minimal flooding risk. Drainage systems should handle expected rainfall for {crop} fields."
        elif label == "Moderate":
            return f"Moderate flood risk — ensure field drainage channels are clear for {crop}. Avoid low-lying areas for new planting."
        elif label == "High":
            return f"High flood risk detected. Clear all drainage channels immediately. Consider temporary bunding around {crop} fields. Harvest mature crops early if possible."
        else:
            return f"CRITICAL: Severe flooding likely. Evacuate livestock from low-lying {crop} fields. Do NOT enter waterlogged fields. Contact district agriculture helpline for emergency support."


# ---------------------------------------------------------------------------
# Main Assessment Function
# ---------------------------------------------------------------------------

def compute_risk_assessment(
    lat: float,
    lon: float,
    crop: str,
    location_label: str,
    api_key: str,
) -> Dict[str, Any]:
    """
    Fetch 5-day forecast from OpenWeatherMap and compute daily risk scores.

    Returns a complete risk assessment dict ready for the API response.
    """
    # 1. Fetch 5-day / 3-hour forecast
    forecast_url = (
        f"http://api.openweathermap.org/data/2.5/forecast"
        f"?lat={lat}&lon={lon}&appid={api_key}&units=metric"
    )
    response = requests.get(forecast_url, timeout=15)
    if not response.ok:
        raise RuntimeError(f"Weather API error: {response.status_code}")

    forecast_data = response.json()

    # 2. Aggregate into daily buckets
    daily_buckets: Dict[str, Dict[str, Any]] = {}

    for item in forecast_data["list"]:
        date_str = item["dt_txt"].split(" ")[0]

        if date_str not in daily_buckets:
            daily_buckets[date_str] = {
                "temp_maxes": [],
                "humidities": [],
                "wind_speeds": [],
                "pops": [],
                "pressures": [],
                "date_obj": datetime.strptime(date_str, "%Y-%m-%d"),
            }

        bucket = daily_buckets[date_str]
        bucket["temp_maxes"].append(item["main"]["temp_max"])
        bucket["humidities"].append(item["main"]["humidity"])
        bucket["wind_speeds"].append(item["wind"]["speed"] * 3.6)  # m/s → km/h
        bucket["pops"].append(item.get("pop", 0) * 100)            # 0-1 → 0-100
        bucket["pressures"].append(item["main"]["pressure"])

    # 3. Build daily summary dicts
    today = datetime.now().date()
    sorted_dates = sorted(daily_buckets.keys())

    daily_summaries: List[Dict[str, Any]] = []
    for date_str in sorted_dates:
        bucket = daily_buckets[date_str]
        if bucket["date_obj"].date() < today:
            continue
        if len(daily_summaries) >= 5:
            break

        summary = {
            "date_str": date_str,
            "date_obj": bucket["date_obj"],
            "temp_max": max(bucket["temp_maxes"]),
            "avg_humidity": sum(bucket["humidities"]) / len(bucket["humidities"]),
            "avg_wind_speed": sum(bucket["wind_speeds"]) / len(bucket["wind_speeds"]),
            "avg_pop": sum(bucket["pops"]) / len(bucket["pops"]),
            "avg_pressure": sum(bucket["pressures"]) / len(bucket["pressures"]),
        }
        daily_summaries.append(summary)

    if not daily_summaries:
        raise RuntimeError("No forecast data available for the requested period")

    # 4. Get crop sensitivity profile
    sensitivity = CROP_PROFILES.get(crop, DEFAULT_SENSITIVITY)

    # 5. Compute scores per day
    weekly_trend: List[Dict[str, Any]] = []
    all_drought, all_pest, all_flood = [], [], []

    for day in daily_summaries:
        raw_drought = _compute_drought_score(day)
        raw_pest    = _compute_pest_score(day)
        raw_flood   = _compute_flood_score(day)

        # Apply crop sensitivity
        adj_drought = _clamp(raw_drought * sensitivity["drought"])
        adj_pest    = _clamp(raw_pest    * sensitivity["pest"])
        adj_flood   = _clamp(raw_flood   * sensitivity["flood"])

        all_drought.append(adj_drought)
        all_pest.append(adj_pest)
        all_flood.append(adj_flood)

        is_today = day["date_obj"].date() == today
        is_tomorrow = day["date_obj"].date() == today + timedelta(days=1)
        if is_today:
            date_label = f"Today, {day['date_obj'].strftime('%d %b')}"
        elif is_tomorrow:
            date_label = f"Tomorrow, {day['date_obj'].strftime('%d %b')}"
        else:
            date_label = day["date_obj"].strftime("%a, %d %b")

        weekly_trend.append({
            "day": date_label,
            "drought": round(adj_drought),
            "pest": round(adj_pest),
            "flood": round(adj_flood),
        })

    # 6. Overall scores = weighted average (today weighted 2x)
    weights = [2.0] + [1.0] * (len(all_drought) - 1)
    total_w = sum(weights)

    overall_drought = sum(d * w for d, w in zip(all_drought, weights)) / total_w
    overall_pest    = sum(p * w for p, w in zip(all_pest,    weights)) / total_w
    overall_flood   = sum(f * w for f, w in zip(all_flood,   weights)) / total_w
    overall_risk    = (overall_drought + overall_pest + overall_flood) / 3

    # Advisory is based on the *today* data (first day)
    today_data = daily_summaries[0]

    return {
        "location": location_label,
        "crop": crop,
        "assessment_date": datetime.now().strftime("%Y-%m-%d"),
        "overall_risk": round(overall_risk),
        "overall_label": _label(overall_risk),
        "risks": {
            "drought": {
                "score": round(overall_drought),
                "label": _label(overall_drought),
                "advisory": _generate_advisory("drought", overall_drought, today_data, crop),
            },
            "pest": {
                "score": round(overall_pest),
                "label": _label(overall_pest),
                "advisory": _generate_advisory("pest", overall_pest, today_data, crop),
            },
            "flood": {
                "score": round(overall_flood),
                "label": _label(overall_flood),
                "advisory": _generate_advisory("flood", overall_flood, today_data, crop),
            },
        },
        "weekly_trend": weekly_trend,
        "crop_sensitivity": sensitivity,
    }
