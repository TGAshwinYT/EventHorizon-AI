"""
Satellite Router — EventHorizon AI
====================================
Dual-source NDVI: Sentinel Hub (10m, 5-day) when configured,
NASA MODIS (250m, 16-day) as universal fallback.
"""

from fastapi import APIRouter, HTTPException, Request, Query
from typing import Optional

from app.services.satellite_ndvi_service import get_ndvi_analysis
from app.services.sentinel_hub_service import (
    is_sentinel_hub_configured, fetch_sentinel_ndvi,
)
from app.services.india_locations import find_nearest_district, get_coords_for_district
from app.cache_utils import TTLCache

router = APIRouter()

_ip_cache = TTLCache(ttl_seconds=86400)


def _get_client_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def _ip_to_coords(ip: str) -> Optional[dict]:
    if not ip or ip in ("127.0.0.1", "::1", "localhost"):
        return None
    cached = _ip_cache.get(f"sat_ip_{ip}")
    if cached:
        return cached
    try:
        import requests as req
        res = req.get(f"http://ip-api.com/json/{ip}?fields=status,lat,lon", timeout=5)
        if res.ok:
            data = res.json()
            if data.get("status") == "success":
                result = {"lat": data["lat"], "lon": data["lon"]}
                _ip_cache.set(f"sat_ip_{ip}", result)
                return result
    except Exception:
        pass
    return None


def _resolve_coords(
    request: Request,
    lat: Optional[float], lon: Optional[float],
    state: Optional[str], district: Optional[str],
):
    """Resolve coordinates from params or IP fallback."""
    if lat is not None and lon is not None:
        return lat, lon

    if state and district:
        db_lat, db_lon = get_coords_for_district(state, district)
        if db_lat is not None:
            return db_lat, db_lon
        raise HTTPException(status_code=404, detail=f"District '{district}' not found in '{state}'")

    ip = _get_client_ip(request)
    if ip:
        coords = _ip_to_coords(ip)
        if coords:
            return coords["lat"], coords["lon"]

    raise HTTPException(
        status_code=400,
        detail="Location required. Provide lat+lon, state+district, or allow IP detection.",
    )


def _build_advisory(ndvi: float, trend: dict) -> dict:
    """Generate advisory from NDVI + trend data."""
    signal = trend.get("signal", "normal")
    direction = trend.get("direction", "stable")
    drops = trend.get("consecutive_drops", 0)

    if signal == "drought_alert":
        return {
            "severity": "critical",
            "title": "⚠️ Early Drought Signal Detected",
            "message": f"Vegetation index declining for {drops} consecutive periods, now at {ndvi:.2f} (stressed). Increase irrigation immediately.",
        }
    elif signal == "persistent_decline":
        return {
            "severity": "warning",
            "title": "📉 Persistent Vegetation Decline",
            "message": f"NDVI dropped for {drops} consecutive periods. Current: {ndvi:.2f}. Check for pest, nutrient, or water stress.",
        }
    elif signal in ("browning", "stress_warning"):
        return {
            "severity": "warning",
            "title": "🍂 Vegetation Stress" if signal == "stress_warning" else "🍂 Browning Detected",
            "message": f"NDVI declining, now at {ndvi:.2f}. May be seasonal or indicate emerging stress.",
        }
    elif signal == "greening":
        return {
            "severity": "positive",
            "title": "🌱 Vegetation Recovery / Growth",
            "message": f"NDVI improving, current: {ndvi:.2f}. Growth looks healthy.",
        }
    else:
        return {
            "severity": "info",
            "title": "✅ Vegetation Stable",
            "message": f"Current NDVI: {ndvi:.2f}. No significant changes detected.",
        }


@router.get("/ndvi")
async def get_ndvi(
    request: Request,
    lat: Optional[float] = Query(None, description="Latitude"),
    lon: Optional[float] = Query(None, description="Longitude"),
    state: Optional[str] = Query(None, description="State name"),
    district: Optional[str] = Query(None, description="District name"),
    periods: int = Query(6, ge=2, le=12, description="Number of periods (MODIS: 16-day, Sentinel: 5-day)"),
    source: Optional[str] = Query(None, description="Force source: 'sentinel' or 'modis'"),
):
    """
    Fetch NDVI vegetation health analysis.

    Auto-selects best available source:
      - Sentinel Hub (10m, 5-day) when configured
      - NASA MODIS (250m, 16-day) as universal fallback

    Use ?source=sentinel or ?source=modis to force a specific source.
    """
    final_lat, final_lon = _resolve_coords(request, lat, lon, state, district)

    # Determine source
    use_sentinel = is_sentinel_hub_configured()
    if source == "modis":
        use_sentinel = False
    elif source == "sentinel" and not use_sentinel:
        raise HTTPException(status_code=503, detail="Sentinel Hub not configured. Set SENTINELHUB_CLIENT_ID/SECRET in .env")

    result = None

    # Try Sentinel Hub first (better resolution)
    if use_sentinel:
        sentinel_data = fetch_sentinel_ndvi(final_lat, final_lon, days_back=periods * 5)
        if sentinel_data and sentinel_data.get("current"):
            # Build full response from Sentinel data
            result = {
                **sentinel_data,
                "product": "Sentinel-2 L2A",
                "advisory": _build_advisory(
                    sentinel_data["current"]["ndvi"],
                    sentinel_data["trend"],
                ),
                "data_source": "Copernicus Sentinel Hub (10m)",
                "last_updated": __import__('datetime').datetime.utcnow().isoformat() + "Z",
            }

    # Fallback to MODIS
    if not result:
        result = get_ndvi_analysis(final_lat, final_lon, periods=periods)
        if use_sentinel and source != "modis":
            result["sentinel_fallback"] = True
            result["sentinel_note"] = "Sentinel Hub data unavailable for this location/period. Using MODIS fallback."

    # Enrich with location name
    nearest = find_nearest_district(final_lat, final_lon)
    if nearest:
        result["location"] = f"{nearest['district']}, {nearest['state']}"
    else:
        result["location"] = f"{final_lat:.2f}°N, {final_lon:.2f}°E"

    return result


@router.get("/ndvi/compare")
async def compare_sources(
    request: Request,
    lat: Optional[float] = Query(None, description="Latitude"),
    lon: Optional[float] = Query(None, description="Longitude"),
    state: Optional[str] = Query(None, description="State name"),
    district: Optional[str] = Query(None, description="District name"),
):
    """
    Compare NDVI from both sources side-by-side.
    Returns Sentinel Hub (10m) and MODIS (250m) data together.
    """
    final_lat, final_lon = _resolve_coords(request, lat, lon, state, district)

    nearest = find_nearest_district(final_lat, final_lon)
    location = f"{nearest['district']}, {nearest['state']}" if nearest else f"{final_lat:.2f}°N, {final_lon:.2f}°E"

    comparison = {
        "location": location,
        "latitude": final_lat,
        "longitude": final_lon,
        "sources": {},
    }

    # MODIS (always available)
    modis = get_ndvi_analysis(final_lat, final_lon, periods=6)
    comparison["sources"]["modis"] = {
        "available": bool(modis.get("current")),
        "resolution": "250m",
        "update_frequency": "16 days",
        "current_ndvi": modis["current"]["ndvi"] if modis.get("current") else None,
        "status": modis["current"]["status"] if modis.get("current") else "unavailable",
        "trend": modis.get("trend"),
        "data_points": len(modis.get("time_series", [])),
    }

    # Sentinel Hub (if configured)
    if is_sentinel_hub_configured():
        sentinel = fetch_sentinel_ndvi(final_lat, final_lon)
        comparison["sources"]["sentinel"] = {
            "available": bool(sentinel and sentinel.get("current")),
            "resolution": "10m",
            "update_frequency": "5 days",
            "current_ndvi": sentinel["current"]["ndvi"] if sentinel and sentinel.get("current") else None,
            "status": sentinel["current"]["status"] if sentinel and sentinel.get("current") else "unavailable",
            "trend": sentinel.get("trend") if sentinel else None,
            "data_points": len(sentinel.get("time_series", [])) if sentinel else 0,
        }
    else:
        comparison["sources"]["sentinel"] = {
            "available": False,
            "reason": "SENTINELHUB_CLIENT_ID/SECRET not configured",
        }

    return comparison


@router.get("/ndvi/health")
async def ndvi_health():
    """Health check for satellite NDVI services."""
    sentinel_configured = is_sentinel_hub_configured()

    return {
        "status": "operational",
        "service": "Satellite NDVI (Dual-Source)",
        "sources": {
            "modis": {
                "status": "active",
                "api": "ORNL DAAC REST API",
                "product": "MOD13Q1",
                "resolution": "250m",
                "update_frequency": "16 days",
                "authentication": "none",
            },
            "sentinel": {
                "status": "active" if sentinel_configured else "not_configured",
                "api": "Sentinel Hub Statistical API",
                "product": "Sentinel-2 L2A",
                "resolution": "10m",
                "update_frequency": "5 days",
                "authentication": "OAuth2 (configured)" if sentinel_configured else "credentials missing",
            },
        },
        "auto_select": "Sentinel Hub preferred when available, MODIS fallback",
    }
