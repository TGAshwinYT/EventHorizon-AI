"""
Satellite NDVI Service — EventHorizon AI
==========================================
Fetches vegetation health (NDVI) data from NASA's ORNL DAAC MODIS
REST API. Uses MOD13Q1 product (250m, 16-day composite).

Free, no API key required.

NDVI Scale:
  -1.0 to 0.0  → Water / barren / snow
   0.0 to 0.2  → Bare soil / sparse vegetation
   0.2 to 0.4  → Stressed / unhealthy vegetation
   0.4 to 0.6  → Moderate vegetation
   0.6 to 0.8  → Healthy vegetation
   0.8 to 1.0  → Very dense / lush vegetation
"""

import requests
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List

from app.cache_utils import TTLCache

# ──────────────────────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────────────────────

ORNL_BASE = "https://modis.ornl.gov/rst/api/v1"
PRODUCT = "MOD13Q1"  # 16-day NDVI at 250m resolution
BAND = "250m_16_days_NDVI"
QUALITY_BAND = "250m_16_days_pixel_reliability"

# Cache NDVI data for 6 hours (satellite data updates every 16 days)
_ndvi_cache = TTLCache(ttl_seconds=21600)

# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────

def _date_to_modis(dt: datetime) -> str:
    """Convert datetime to MODIS date format AYYYYDDD."""
    return f"A{dt.year}{dt.timetuple().tm_yday:03d}"


def _modis_to_date(modis_date: str) -> datetime:
    """Convert MODIS date AYYYYDDD to datetime."""
    year = int(modis_date[1:5])
    doy = int(modis_date[5:8])
    return datetime(year, 1, 1) + timedelta(days=doy - 1)


def _classify_ndvi(ndvi: float) -> Dict[str, Any]:
    """Classify NDVI value into health category."""
    if ndvi < 0:
        return {"status": "Water/Barren", "color": "#6b7280", "emoji": "🏜️", "health_pct": 0}
    elif ndvi < 0.2:
        return {"status": "Bare Soil", "color": "#d97706", "emoji": "🟤", "health_pct": 15}
    elif ndvi < 0.35:
        return {"status": "Stressed", "color": "#ef4444", "emoji": "⚠️", "health_pct": 30}
    elif ndvi < 0.5:
        return {"status": "Moderate", "color": "#f59e0b", "emoji": "🌿", "health_pct": 55}
    elif ndvi < 0.65:
        return {"status": "Healthy", "color": "#22c55e", "emoji": "🌾", "health_pct": 75}
    elif ndvi < 0.8:
        return {"status": "Very Healthy", "color": "#10b981", "emoji": "🌳", "health_pct": 90}
    else:
        return {"status": "Lush", "color": "#059669", "emoji": "🌲", "health_pct": 100}


def _compute_trend(values: List[float]) -> Dict[str, Any]:
    """Analyse NDVI trend over time series."""
    if len(values) < 2:
        return {"direction": "stable", "change": 0, "signal": "insufficient_data"}

    # Compare latest vs previous
    latest = values[-1]
    previous = values[-2]
    change = latest - previous

    # Compare latest vs 4-period average (if available)
    if len(values) >= 4:
        avg_older = sum(values[:-1]) / len(values[:-1])
        long_change = latest - avg_older
    else:
        long_change = change

    # Classify trend
    if change > 0.05:
        direction = "improving"
        signal = "greening"
    elif change < -0.05:
        direction = "declining"
        signal = "stress_warning" if latest < 0.4 else "browning"
    else:
        direction = "stable"
        signal = "normal"

    # Drought early warning: NDVI dropping over consecutive periods
    consecutive_drops = 0
    for i in range(len(values) - 1, 0, -1):
        if values[i] < values[i - 1]:
            consecutive_drops += 1
        else:
            break

    if consecutive_drops >= 2 and latest < 0.4:
        signal = "drought_alert"
    elif consecutive_drops >= 3:
        signal = "persistent_decline"

    return {
        "direction": direction,
        "change_16day": round(change, 4),
        "change_long_term": round(long_change, 4),
        "consecutive_drops": consecutive_drops,
        "signal": signal,
    }


# ──────────────────────────────────────────────────────────────
# API Fetch Functions
# ──────────────────────────────────────────────────────────────

def _fetch_available_dates(lat: float, lon: float) -> List[str]:
    """Get all available MODIS dates for a location."""
    cache_key = f"ndvi_dates_{round(lat, 2)}_{round(lon, 2)}"
    cached = _ndvi_cache.get(cache_key)
    if cached:
        return cached

    try:
        url = f"{ORNL_BASE}/{PRODUCT}/dates"
        res = requests.get(
            url,
            params={"latitude": lat, "longitude": lon},
            headers={"Accept": "application/json"},
            timeout=15,
        )
        if res.ok:
            data = res.json()
            dates = [d["modis_date"] for d in data.get("dates", [])]
            _ndvi_cache.set(cache_key, dates)
            return dates
    except Exception as e:
        print(f"[NDVI] Failed to fetch dates: {e}")

    return []


def _fetch_ndvi_subset(
    lat: float, lon: float,
    start_date: str, end_date: str,
) -> Optional[Dict[str, Any]]:
    """Fetch NDVI subset data from ORNL DAAC."""
    try:
        url = f"{ORNL_BASE}/{PRODUCT}/subset"
        res = requests.get(
            url,
            params={
                "latitude": lat,
                "longitude": lon,
                "band": BAND,
                "startDate": start_date,
                "endDate": end_date,
                "kmAboveBelow": 0,
                "kmLeftRight": 0,
            },
            headers={"Accept": "application/json"},
            timeout=30,
        )
        if res.ok:
            return res.json()
    except Exception as e:
        print(f"[NDVI] Subset fetch error: {e}")

    return None


# ──────────────────────────────────────────────────────────────
# Main Public Functions
# ──────────────────────────────────────────────────────────────

def get_ndvi_analysis(lat: float, lon: float, periods: int = 6) -> Dict[str, Any]:
    """
    Fetch NDVI time series for a location and compute vegetation health
    analysis with trend detection.

    Args:
        lat: Latitude (decimal degrees)
        lon: Longitude (decimal degrees)
        periods: Number of 16-day periods to fetch (default 6 = ~3 months)

    Returns:
        Full NDVI analysis dict with current health, trend, and history.
    """
    cache_key = f"ndvi_analysis_{round(lat, 3)}_{round(lon, 3)}_{periods}"
    cached = _ndvi_cache.get(cache_key)
    if cached:
        return cached

    # Get available dates
    all_dates = _fetch_available_dates(lat, lon)
    if not all_dates:
        return _fallback_response(lat, lon, "No satellite data available for this location")

    # Take the most recent N dates
    recent_dates = all_dates[-periods:] if len(all_dates) >= periods else all_dates
    if not recent_dates:
        return _fallback_response(lat, lon, "No recent satellite dates available")

    start = recent_dates[0]
    end = recent_dates[-1]

    # Fetch NDVI data for the date range
    raw_data = _fetch_ndvi_subset(lat, lon, start, end)
    if not raw_data or "subset" not in raw_data:
        return _fallback_response(lat, lon, "Failed to fetch satellite data")

    # Parse NDVI values from subset
    ndvi_series = []
    for entry in raw_data["subset"]:
        modis_date = entry.get("calendar_date") or entry.get("modis_date", "")
        raw_values = entry.get("data", [])

        # NDVI is scaled by 10000 in MOD13Q1
        # Take the center pixel (index 0 for 0km subset)
        if raw_values:
            raw_val = raw_values[0]
            # Filter out fill values and invalid data
            if -2000 < raw_val < 10000:
                ndvi = raw_val / 10000.0
            else:
                continue

            # Parse date
            if modis_date and modis_date.startswith("A"):
                dt = _modis_to_date(modis_date)
            elif modis_date:
                try:
                    dt = datetime.strptime(modis_date, "%Y-%m-%d")
                except ValueError:
                    continue
            else:
                continue

            ndvi_series.append({
                "date": dt.strftime("%Y-%m-%d"),
                "date_label": dt.strftime("%d %b"),
                "ndvi": round(ndvi, 4),
                "classification": _classify_ndvi(ndvi),
            })

    if not ndvi_series:
        return _fallback_response(lat, lon, "No valid NDVI readings found")

    # Current (latest) reading
    current = ndvi_series[-1]
    ndvi_values = [p["ndvi"] for p in ndvi_series]

    # Trend analysis
    trend = _compute_trend(ndvi_values)

    # Statistics
    stats = {
        "min": round(min(ndvi_values), 4),
        "max": round(max(ndvi_values), 4),
        "mean": round(sum(ndvi_values) / len(ndvi_values), 4),
        "range": round(max(ndvi_values) - min(ndvi_values), 4),
        "data_points": len(ndvi_series),
        "period_days": (periods - 1) * 16,
    }

    # Build advisory based on signal
    advisory = _build_advisory(current["ndvi"], trend)

    result = {
        "latitude": lat,
        "longitude": lon,
        "product": PRODUCT,
        "resolution": "250m",
        "current": {
            "ndvi": current["ndvi"],
            "date": current["date"],
            **current["classification"],
        },
        "trend": trend,
        "statistics": stats,
        "time_series": ndvi_series,
        "advisory": advisory,
        "data_source": "NASA MODIS (ORNL DAAC)",
        "last_updated": datetime.utcnow().isoformat() + "Z",
    }

    _ndvi_cache.set(cache_key, result)
    return result


def _build_advisory(ndvi: float, trend: Dict[str, Any]) -> Dict[str, str]:
    """Generate human-readable advisory from NDVI data."""
    signal = trend["signal"]
    direction = trend["direction"]

    if signal == "drought_alert":
        return {
            "severity": "critical",
            "title": "⚠️ Early Drought Signal Detected",
            "message": (
                f"Vegetation index has been declining for {trend['consecutive_drops']} consecutive "
                f"periods and is now at {ndvi:.2f} (stressed level). This is a strong early indicator "
                f"of drought stress. Increase irrigation immediately and consider mulching."
            ),
        }
    elif signal == "persistent_decline":
        return {
            "severity": "warning",
            "title": "📉 Persistent Vegetation Decline",
            "message": (
                f"Vegetation health has dropped for {trend['consecutive_drops']} consecutive periods. "
                f"Current NDVI: {ndvi:.2f}. Monitor closely and check for pest damage, nutrient "
                f"deficiency, or water stress."
            ),
        }
    elif signal == "browning":
        return {
            "severity": "warning",
            "title": "🍂 Browning Detected",
            "message": (
                f"Vegetation greenness has decreased by {abs(trend['change_16day']):.3f} in the last "
                f"16 days. Current NDVI: {ndvi:.2f}. This may be seasonal or indicate emerging stress."
            ),
        }
    elif signal == "stress_warning":
        return {
            "severity": "warning",
            "title": "🔻 Vegetation Stress Warning",
            "message": (
                f"NDVI is at {ndvi:.2f} (stressed range) and declining. Check soil moisture, "
                f"irrigation systems, and look for pest/disease signs."
            ),
        }
    elif signal == "greening":
        return {
            "severity": "positive",
            "title": "🌱 Vegetation Recovery / Growth",
            "message": (
                f"Vegetation health is improving — NDVI increased by {trend['change_16day']:.3f} "
                f"in the last period. Current: {ndvi:.2f}. Growth looks healthy."
            ),
        }
    else:
        return {
            "severity": "info",
            "title": "✅ Vegetation Stable",
            "message": (
                f"Current NDVI: {ndvi:.2f}. Vegetation health is stable with no significant "
                f"changes detected. Continue routine monitoring."
            ),
        }


def _fallback_response(lat: float, lon: float, reason: str) -> Dict[str, Any]:
    """Return a structured error response when satellite data is unavailable."""
    return {
        "latitude": lat,
        "longitude": lon,
        "product": PRODUCT,
        "resolution": "250m",
        "current": None,
        "trend": None,
        "statistics": None,
        "time_series": [],
        "advisory": {
            "severity": "info",
            "title": "📡 Satellite Data Unavailable",
            "message": reason,
        },
        "data_source": "NASA MODIS (ORNL DAAC)",
        "last_updated": datetime.utcnow().isoformat() + "Z",
        "error": reason,
    }
