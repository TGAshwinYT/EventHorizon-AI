import os
import httpx
from app.services.india_locations import get_coords_for_district

async def get_coords_with_place(state: str, district: str, place: str = "", client: httpx.AsyncClient = None) -> tuple[float, float]:
    """Resolves coordinates, prioritizing the specific place/mandal if available,
    otherwise falling back to district coordinates.
    """
    api_key = os.getenv("OPENWEATHERMAP_API_KEY")
    place_cleaned = place.strip() if place else ""
    
    if api_key and place_cleaned:
        async def _geocode(query: str) -> tuple[float, float]:
            url = f"http://api.openweathermap.org/geo/1.0/direct?q={query}&limit=1&appid={api_key}"
            if client:
                resp = await client.get(url, timeout=5)
            else:
                async with httpx.AsyncClient() as c:
                    resp = await c.get(url, timeout=5)
            if resp.status_code == 200 and resp.json():
                geo = resp.json()[0]
                return geo['lat'], geo['lon']
            return None, None

        # 1. Try: place, district, state, IN
        try:
            lat, lon = await _geocode(f"{place_cleaned},{district},{state},IN")
            if lat is not None:
                return lat, lon
        except Exception:
            pass
        
        # 2. Try: place, state, IN
        try:
            lat, lon = await _geocode(f"{place_cleaned},{state},IN")
            if lat is not None:
                return lat, lon
        except Exception:
            pass

    # 3. Fallback to static district coordinates
    lat, lon = get_coords_for_district(state, district)
    if lat is not None and lon is not None:
        return lat, lon

    # 4. Fallback to geocoding district as a backup
    if api_key and district:
        try:
            url = f"http://api.openweathermap.org/geo/1.0/direct?q={district},{state},IN&limit=1&appid={api_key}"
            if client:
                resp = await client.get(url, timeout=5)
            else:
                async with httpx.AsyncClient() as c:
                    resp = await c.get(url, timeout=5)
            if resp.status_code == 200 and resp.json():
                geo = resp.json()[0]
                return geo['lat'], geo['lon']
        except Exception:
            pass

    # Default fallback (Coimbatore coordinates)
    return 11.0183, 76.971
