from fastapi import APIRouter, Query, Request, Depends
from fastapi.responses import JSONResponse

from app.database import MandiSessionLocal, get_mandi_db
from app.cache_utils import TTLCache

forecast_cache = TTLCache(ttl_seconds=10800)  # 3 hours cache


router = APIRouter()

@router.get('/')
def get_market_data():
    """Get current agricultural market prices"""
    data = [
        {"name": "Tomato (Today)", "price": "₹1,240 / quintal", "location": "Azadpur Mandi", "trend": "up"},
        {"name": "Potato", "price": "₹850 / quintal", "location": "Agra", "trend": "stable"},
        {"name": "Onion", "price": "₹1,100 / quintal", "location": "Nasik", "trend": "down"},
        {"name": "Cauliflower", "price": "₹600 / quintal", "location": "Local", "trend": "up"},
        {"name": "Spinach", "price": "₹400 / quintal", "location": "Local", "trend": "up"},
        {"name": "Carrot", "price": "₹950 / quintal", "location": "Haryana", "trend": "stable"},
        {"name": "Rice (Basmati)", "price": "₹3,500 / quintal", "location": "Punjab", "trend": "up"},
    ]
    return data


from sqlalchemy.orm import Session
from async_lru import alru_cache
import asyncio
from sqlalchemy import desc
from app.models import MandiRate
import os
import json
import httpx
from datetime import datetime

async def fetch_datagov_prices(crop: str, state: str, district: str = None):
    datagov_key = os.getenv("DATAGOV_API_KEY") or os.getenv("AGMARKNET_API_KEY") or os.getenv("OGD_API_KEY")
    if not datagov_key:
        return None
        
    commodityMap = {
        "Tomato": "Tomato", "Onion": "Onion", "Potato": "Potato", "Cabbage": "Cabbage",
        "Cauliflower": "Cauliflower", "Brinjal": "Brinjal", "Lady Finger (Bhindi)": "Bhindi(Ladies Finger)",
        "Green Chilli": "Green Chilli", "Garlic": "Garlic", "Ginger": "Ginger", "Capsicum": "Capsicum",
        "Carrot": "Carrot", "Bitter Gourd": "Bitter Gourd", "Bottle Gourd": "Bottle Gourd",
        "Wheat": "Wheat", "Rice (Paddy)": "Rice", "Maize": "Maize", "Soybean": "Soybean",
        "Groundnut": "Groundnut", "Banana": "Banana", "Mango": "Mango", "Turmeric": "Turmeric"
    }
    commodity = commodityMap.get(crop, crop)
    
    url = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"
    params = {
        "api-key": datagov_key,
        "format": "json",
        "limit": "10",
        "filters[commodity]": commodity,
        "filters[state]": state
    }
    if district and district != "All Districts":
        params["filters[district]"] = district
        
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
        try:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            json_data = resp.json()
            records = json_data.get("records", [])
            if not records:
                return None
                
            history = []
            recent_data = []
            parsed_records = []
            for r in records:
                try:
                    d_obj = datetime.strptime(r["arrival_date"], "%d/%m/%Y")
                    parsed_records.append((d_obj, r))
                except:
                    pass
            parsed_records.sort(key=lambda x: x[0], reverse=True)
            sorted_records = [x[1] for x in parsed_records][:7]
            
            if not sorted_records: return None
            
            for r in sorted_records:
                d_str = r["arrival_date"]
                try:
                    d_obj = datetime.strptime(r["arrival_date"], "%d/%m/%Y")
                    d_str = d_obj.strftime("%d %b")
                except:
                    pass
                modal = float(r["modal_price"])
                min_p = float(r["min_price"])
                max_p = float(r["max_price"])
                history.append({"date": d_str, "price": modal, "min": min_p, "max": max_p})
                recent_data.append({"date": d_str, "min": min_p, "max": max_p, "modal": modal})
                
            current_price = float(sorted_records[0]["modal_price"])
            change_str = "-"
            if len(sorted_records) > 1:
                prev_price = float(sorted_records[1]["modal_price"])
                if prev_price > 0:
                    pct = ((current_price - prev_price) / prev_price) * 100
                    change_str = f"{pct:+.1f}%"
                    
            all_min = min((float(r["min_price"]) for r in sorted_records if float(r["min_price"]) > 0), default=0)
            all_max = max((float(r["max_price"]) for r in sorted_records if float(r["max_price"]) > 0), default=0)
            
            return {
                "current_price": f"₹{int(current_price):,}",
                "price_unit": "per quintal",
                "change": change_str,
                "market": f"{crop} - {state}{' - ' + district if district and district != 'All Districts' else ''} (Live)",
                "history": list(reversed(history)),
                "recent_data": recent_data,
                "min_price": f"₹{int(all_min):,}",
                "max_price": f"₹{int(all_max):,}"
            }
        except Exception as e:
            print(f"data.gov API error: {e}")
            return None

async def fetch_gemini_prices(crop: str, state: str, district: str = None):
    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key:
        return None
        
    today = datetime.now().strftime("%d %b %Y")
    month = datetime.now().strftime("%B")
    location = f"{district}, {state}" if district and district != "All Districts" else state
    
    prompt = f"""You are an Indian agricultural mandi market expert. Today is {today}.
Give realistic current mandi prices for "{crop}" in {location}, India.
Respond ONLY with raw JSON — no markdown, no explanation, nothing else:
{{
  "modal": <number>,
  "min": <number>,
  "max": <number>,
  "change_pct": <number, e.g. 2.5 or -3.1>,
  "trend": "rising" | "falling" | "stable",
  "insight": "<one sentence about why prices are at this level in {month}>",
  "history": [
    {{ "date": "DD Mon", "min": <number>, "max": <number>, "modal": <number> }}
  ]
}}
Rules:
- All prices in ₹ per quintal (100 kg)
- Use realistic seasonal prices for {month} in India
- modal must be between min and max
- history should have 7 entries, oldest first, ending today with realistic variation
- Return ONLY the JSON object"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key={gemini_key}"
    
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            print(f"[Gemini] Calling API for {crop} in {location}...")
            resp = await client.post(
                url,
                headers={"Content-Type": "application/json"},
                json={
                    "contents": [{
                        "parts": [{"text": prompt}]
                    }],
                    "generationConfig": {
                        "responseMimeType": "application/json"
                    }
                }
            )
            print(f"[Gemini] Response Status: {resp.status_code}")
            resp.raise_for_status()
            
            resp_data = resp.json()
            raw_text = resp_data["candidates"][0]["content"]["parts"][0]["text"]
            
            data = json.loads(raw_text.strip())
            
            history = []
            recent_data = []
            hist_list = data.get("history", [])
            for h in reversed(hist_list):
                recent_data.append({
                    "date": h["date"],
                    "min": h["min"],
                    "max": h["max"],
                    "modal": h["modal"]
                })
            for h in hist_list:
                history.append({
                    "date": h["date"],
                    "price": h["modal"],
                    "min": h["min"],
                    "max": h["max"]
                })
                
            change_pct = data.get("change_pct", 0)
            change_str = f"{change_pct:+.1f}%"
            
            all_min = min((h["min"] for h in hist_list), default=0)
            all_max = max((h["max"] for h in hist_list), default=0)
            
            return {
                "current_price": f"₹{int(data['modal']):,}",
                "price_unit": "per quintal",
                "change": change_str,
                "market": f"{crop} - {state}{' - ' + district if district and district != 'All Districts' else ''} (AI Estimated)",
                "history": history,
                "recent_data": recent_data,
                "min_price": f"₹{int(all_min):,}",
                "max_price": f"₹{int(all_max):,}"
            }
        except Exception as e:
            print(f"Gemini API error: {e}")
            return None

def fetch_db_prices(crop: str, state: str, district: str = None):
    from app.database import MandiSessionLocal
    from sqlalchemy import text
    db = MandiSessionLocal()
    try:
        fetch_crop = "Paddy(Dhan)(Common)" if crop == "Rice" else crop
        
        sql = """
            SELECT state, district, market, commodity, arrival_date, min_price, max_price, modal_price 
            FROM mandi_prices 
            WHERE state = :state AND commodity = :crop
        """
        params = {"state": state, "crop": fetch_crop}
        
        if district and district != "All Districts":
            sql += " AND district = :district"
            params["district"] = district
            
        sql += " ORDER BY arrival_date DESC LIMIT 5"
        
        result = db.execute(text(sql), params)
        records = result.fetchall()
        
        if not records:
            return {
                "current_price": "N/A",
                "price_unit": "per quintal",
                "change": "-",
                "market": f"{crop} - {state}{' - ' + district if district and district != 'All Districts' else ''} (No Data)",
                "history": [],
                "recent_data": [],
                "min_price": "N/A",
                "max_price": "N/A"
            }

        history = []
        recent_data = []
        
        for r in records:
            # r is a tuple or row object: (state, district, market, commodity, arrival_date, min_price, max_price, modal_price)
            raw_date = r[4]
            d_str = ""
            if hasattr(raw_date, "strftime"):
                d_str = raw_date.strftime("%d %b")
            else:
                d_str = str(raw_date)
                try:
                    d_obj = datetime.strptime(d_str, "%d/%m/%Y")
                    d_str = d_obj.strftime("%d %b")
                except:
                    pass
                
            modal = float(r[7])
            min_p = float(r[5])
            max_p = float(r[6])
            
            history.append({
                "date": d_str,
                "price": modal,
                "min": min_p,
                "max": max_p
            })
            recent_data.append({
                "date": d_str,
                "min": min_p,
                "max": max_p,
                "modal": modal
            })

        current_price = float(records[0][7])
        change_str = "-"
        if len(records) > 1:
            prev_price = float(records[1][7])
            if prev_price > 0:
                pct = ((current_price - prev_price) / prev_price) * 100
                change_str = f"{pct:+.1f}%"
                
        all_min = min((float(r[5]) for r in records if float(r[5]) > 0), default=0)
        all_max = max((float(r[6]) for r in records if float(r[6]) > 0), default=0)

        return {
            "current_price": f"₹{int(current_price):,}",
            "price_unit": "per quintal",
            "change": change_str,
            "market": f"{crop} - {state}{' - ' + district if district and district != 'All Districts' else ''}",
            "history": list(reversed(history)),
            "recent_data": recent_data,
            "min_price": f"₹{int(all_min):,}",
            "max_price": f"₹{int(all_max):,}"
        }
    finally:
        db.close()

@alru_cache(maxsize=256)
async def fetch_mandi_prices_cached(crop: str, state: str, district: str = None):
    # Tier 1: Live API
    res = await fetch_datagov_prices(crop, state, district)
    if res:
        return res
        
    # Tier 2: AI Simulation
    res = await fetch_gemini_prices(crop, state, district)
    if res:
        return res
        
    # Tier 3: DB Fallback
    return await asyncio.to_thread(fetch_db_prices, crop, state, district)


@router.get('/mandi')
async def get_mandi_rates(
    crop: str = Query(..., description="Crop Name"), 
    state: str = Query(..., description="State Name"),
    district: str = Query(None, description="Optional District Name")
):
    """Get real-time Mandi rates with O(1) RAM cache and O(log N) DB fetches"""
    return await fetch_mandi_prices_cached(crop, state, district)

@router.get('/districts')
def get_districts(
    crop: str = Query(..., description="Crop Name"),
    state: str = Query(..., description="State Name"),
    db: Session = Depends(get_mandi_db)
):
    """Get distinct districts for a given crop and state"""
    from app.models import MandiRate
    districts = db.query(MandiRate.district).filter(
        MandiRate.state == state,
        MandiRate.commodity == crop
    ).distinct().all()
    return {"districts": sorted([d[0] for d in districts if d[0]])}


@router.get('/forecast')
async def get_price_forecast(
    crop: str = Query(..., description="Crop Name"),
    state: str = Query(..., description="State Name"),
    db: Session = Depends(get_mandi_db)
):
    """Predict future mandi prices using Prophet for the next 7 days"""
    cache_key = f"{crop.lower().strip()}_{state.lower().strip()}"
    cached_forecast = forecast_cache.get(cache_key)
    if cached_forecast:
        return cached_forecast

    from app.models import MandiRate
    from datetime import datetime, timedelta
    import pandas as pd

    # 1. Fetch historical data for the last 30 days
    from sqlalchemy import text
    cutoff_date = (datetime.utcnow() - timedelta(days=30)).date()
    
    sql = """
        SELECT arrival_date, modal_price 
        FROM mandi_prices 
        WHERE state = :state AND commodity = :crop 
          AND modal_price IS NOT NULL 
          AND arrival_date >= :cutoff_date
        ORDER BY arrival_date ASC
    """
    
    result = db.execute(text(sql), {"state": state, "crop": crop, "cutoff_date": cutoff_date})
    records = result.fetchall()
    
    if not records:
        return []
        
    # 2. Format into Pandas DataFrame
    data = []
    
    for r in records:
        raw_date = r[0]
        ds_val = None
        if hasattr(raw_date, "strftime"):
            ds_val = raw_date
        else:
            try:
                ds_val = datetime.strptime(str(raw_date), "%d/%m/%Y")
            except:
                continue
                
        data.append({
            "ds": ds_val,
            "y": float(r[1])
        })
        
    df = pd.DataFrame(data)
    
    # Explicitly convert 'ds' to datetime
    df['ds'] = pd.to_datetime(df['ds'])

    # Aggregate daily to smooth out multiple updates in one day
    df_daily = df.groupby(df['ds'].dt.date)['y'].mean().reset_index()
    # rename columns strictly to ds and y
    df_daily.columns = ['ds', 'y']
    # convert ds back to datetime for prophet
    df_daily['ds'] = pd.to_datetime(df_daily['ds'])

    historical_json = []
    for _, row in df_daily.iterrows():
        historical_json.append({
            "date": row['ds'].strftime("%Y-%m-%d"),
            "price": int(row['y']),
            "isForecast": False
        })

    # Prophet requires at least 2 non-NaN rows to fit
    if len(df_daily) < 2:
        return []

    # Prepare list of dicts for child process execution
    df_daily_dict = df_daily.to_dict('records')

    # 3. Use fast linear forecast (instant, ~1ms) as primary method
    from app.services.forecast_worker import run_linear_forecast
    
    try:
        loop = asyncio.get_running_loop()
        forecast_json = await loop.run_in_executor(
            None,  # Use default ThreadPoolExecutor (lightweight, no process spawn)
            run_linear_forecast,
            df_daily_dict,
            7
        )
    except Exception as e:
        print(f"Linear forecast failed ({e}). Falling back to Prophet.")
        try:
            from app.services.forecast_worker import run_prophet_forecast
            forecast_json = await loop.run_in_executor(
                None,  # Use default ThreadPoolExecutor to avoid spawning processes
                run_prophet_forecast,
                df_daily_dict
            )
        except Exception as pe:
            print(f"Prophet fallback also failed: {pe}")
            forecast_json = []

    # Combine historical and forecasted data
    final_result = historical_json + forecast_json
    forecast_cache.set(cache_key, final_result)
    return final_result

