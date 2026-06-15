"""
Sentinel Hub NDVI Service — EventHorizon AI
=============================================
10m resolution NDVI from Copernicus Sentinel-2 via Sentinel Hub
Statistical API. Updates every 5 days (vs MODIS 16 days).

Requires SENTINELHUB_CLIENT_ID + SENTINELHUB_CLIENT_SECRET in .env.
Uses OAuth2 client_credentials flow — no extra libraries needed.
"""

import os
import time
import requests
import httpx
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from dotenv import load_dotenv

load_dotenv()

from app.cache_utils import TTLCache

# ──────────────────────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────────────────────

# CDSE (Copernicus Data Space Ecosystem) endpoints — free tier
TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
STATS_URL = "https://sh.dataspace.copernicus.eu/api/v1/statistics"

_token_cache: Dict[str, Any] = {"token": None, "expires_at": 0}
_sh_cache = TTLCache(ttl_seconds=14400)  # 4-hour cache

# NDVI evalscript for Sentinel-2 L2A
NDVI_EVALSCRIPT = """
//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "dataMask"] }],
    output: [
      { id: "ndvi", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function evaluatePixel(samples) {
  let ndvi = (samples.B08 - samples.B04) / (samples.B08 + samples.B04);
  return {
    ndvi: [isNaN(ndvi) ? 0 : ndvi],
    dataMask: [samples.dataMask]
  };
}
"""


# ──────────────────────────────────────────────────────────────
# Auth
# ──────────────────────────────────────────────────────────────

def _get_credentials():
    """Get Sentinel Hub credentials from env."""
    cid = os.getenv("SENTINELHUB_CLIENT_ID", "").strip()
    secret = os.getenv("SENTINELHUB_CLIENT_SECRET", "").strip()
    return cid, secret


def is_sentinel_hub_configured() -> bool:
    """Check if Sentinel Hub credentials are available."""
    cid, secret = _get_credentials()
    return bool(cid) and bool(secret)


async def _get_access_token(client: httpx.AsyncClient) -> Optional[str]:
    """Get OAuth2 access token using client_credentials flow."""
    # Check cache
    if _token_cache["token"] and time.time() < _token_cache["expires_at"] - 60:
        return _token_cache["token"]

    cid, secret = _get_credentials()
    if not cid or not secret:
        return None

    try:
        res = await client.post(
            TOKEN_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": cid,
                "client_secret": secret,
            },
            timeout=10,
        )
        if res.status_code == 200:
            data = res.json()
            _token_cache["token"] = data["access_token"]
            _token_cache["expires_at"] = time.time() + data.get("expires_in", 3600)
            print(f"[SentinelHub] Token acquired, expires in {data.get('expires_in', 3600)}s")
            return data["access_token"]
        else:
            print(f"[SentinelHub] Token error {res.status_code}: {res.text[:200]}")
    except Exception as e:
        print(f"[SentinelHub] Token fetch failed: {e}")

    return None


# ──────────────────────────────────────────────────────────────
# NDVI Fetch
# ──────────────────────────────────────────────────────────────

def _make_bbox(lat: float, lon: float, radius_km: float = 0.5):
    """Create a small bounding box around a point (~1km square)."""
    # Approximate degrees per km at equator
    lat_offset = radius_km / 111.0
    lon_offset = radius_km / (111.0 * abs(max(0.1, __import__('math').cos(__import__('math').radians(lat)))))
    return [lon - lon_offset, lat - lat_offset, lon + lon_offset, lat + lat_offset]


async def fetch_sentinel_ndvi(
    lat: float,
    lon: float,
    days_back: int = 90,
    interval_days: int = 5,
    client: Optional[httpx.AsyncClient] = None,
) -> Optional[Dict[str, Any]]:
    """
    Fetch NDVI time series from Sentinel Hub Statistical API.

    Args:
        lat, lon: Location coordinates
        days_back: How many days of history (default 90)
        interval_days: Aggregation interval in days (default 5)
        client: Optional shared httpx AsyncClient

    Returns:
        Parsed NDVI data dict or None on failure.
    """
    cache_key = f"sh_ndvi_{round(lat, 3)}_{round(lon, 3)}_{days_back}"
    cached = _sh_cache.get(cache_key)
    if cached:
        return cached

    if client is None:
        async with httpx.AsyncClient(timeout=30.0) as local_client:
            return await _fetch_sentinel_ndvi_impl(lat, lon, days_back, interval_days, local_client, cache_key)
    else:
        return await _fetch_sentinel_ndvi_impl(lat, lon, days_back, interval_days, client, cache_key)


async def _fetch_sentinel_ndvi_impl(
    lat: float,
    lon: float,
    days_back: int,
    interval_days: int,
    client: httpx.AsyncClient,
    cache_key: str,
) -> Optional[Dict[str, Any]]:
    token = await _get_access_token(client)
    if not token:
        return None

    bbox = _make_bbox(lat, lon, radius_km=0.5)
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days_back)

    payload = {
        "input": {
            "bounds": {
                "bbox": bbox,
                "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/4326"},
            },
            "data": [
                {
                    "type": "sentinel-2-l2a",
                    "dataFilter": {
                        "maxCloudCoverage": 30,
                    },
                }
            ],
        },
        "aggregation": {
            "timeRange": {
                "from": start_date.strftime("%Y-%m-%dT00:00:00Z"),
                "to": end_date.strftime("%Y-%m-%dT23:59:59Z"),
            },
            "aggregationInterval": {"of": f"P{interval_days}D"},
            "evalscript": NDVI_EVALSCRIPT,
            "resx": 10,
            "resy": 10,
        },
    }

    try:
        res = await client.post(
            STATS_URL,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=30,
        )
        if res.status_code == 200:
            data = res.json()
            result = _parse_stats_response(data, lat, lon)
            if result:
                _sh_cache.set(cache_key, result)
            return result
        else:
            print(f"[SentinelHub] Stats API error {res.status_code}: {res.text[:300]}")
    except Exception as e:
        print(f"[SentinelHub] Stats API failed: {e}")

    return None


def _parse_stats_response(raw: Dict, lat: float, lon: float) -> Optional[Dict[str, Any]]:
    """Parse Sentinel Hub Statistical API response into our standard format."""
    data_entries = raw.get("data", [])
    if not data_entries:
        return None

    time_series = []
    ndvi_values = []

    for entry in data_entries:
        interval = entry.get("interval", {})
        date_from = interval.get("from", "")
        outputs = entry.get("outputs", {})
        ndvi_output = outputs.get("ndvi", {})
        bands = ndvi_output.get("bands", {})
        b0 = bands.get("B0", {})
        stats = b0.get("stats", {})

        mean_ndvi = stats.get("mean")
        sample_count = stats.get("sampleCount", 0)
        no_data = stats.get("noDataCount", 0)

        # Skip entries with no valid data
        if mean_ndvi is None or sample_count == 0:
            continue

        # Parse date
        try:
            dt = datetime.fromisoformat(date_from.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            continue

        ndvi = round(mean_ndvi, 4)
        ndvi_values.append(ndvi)

        # Classify
        classification = _classify_ndvi(ndvi)

        time_series.append({
            "date": dt.strftime("%Y-%m-%d"),
            "date_label": dt.strftime("%d %b"),
            "ndvi": ndvi,
            "ndvi_min": round(stats.get("min", ndvi), 4),
            "ndvi_max": round(stats.get("max", ndvi), 4),
            "ndvi_stdev": round(stats.get("stDev", 0), 4),
            "valid_pixels": sample_count,
            "cloud_free_pct": round((sample_count / max(1, sample_count + no_data)) * 100, 1),
            "classification": classification,
        })

    if not time_series:
        return None

    # Sort by date
    time_series.sort(key=lambda x: x["date"])
    ndvi_values = [p["ndvi"] for p in time_series]

    current = time_series[-1]
    trend = _compute_trend(ndvi_values)

    return {
        "source": "sentinel-2",
        "resolution": "10m",
        "update_frequency": "5 days",
        "latitude": lat,
        "longitude": lon,
        "current": {
            "ndvi": current["ndvi"],
            "date": current["date"],
            **current["classification"],
        },
        "trend": trend,
        "statistics": {
            "min": round(min(ndvi_values), 4),
            "max": round(max(ndvi_values), 4),
            "mean": round(sum(ndvi_values) / len(ndvi_values), 4),
            "range": round(max(ndvi_values) - min(ndvi_values), 4),
            "data_points": len(time_series),
            "period_days": 90,
        },
        "time_series": time_series,
    }


# ──────────────────────────────────────────────────────────────
# Shared helpers (same logic as satellite_ndvi_service.py)
# ──────────────────────────────────────────────────────────────

def _classify_ndvi(ndvi: float) -> Dict[str, Any]:
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
    if len(values) < 2:
        return {"direction": "stable", "change": 0, "signal": "insufficient_data"}

    latest = values[-1]
    previous = values[-2]
    change = latest - previous

    if change > 0.05:
        direction, signal = "improving", "greening"
    elif change < -0.05:
        direction = "declining"
        signal = "stress_warning" if latest < 0.4 else "browning"
    else:
        direction, signal = "stable", "normal"

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
        "change_5day": round(change, 4),
        "consecutive_drops": consecutive_drops,
        "signal": signal,
    }
