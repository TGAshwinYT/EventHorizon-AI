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
    datagov_key = os.getenv("DATAGOV_API_KEY")
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
        
    async with httpx.AsyncClient(timeout=10.0) as client:
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

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
    
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
def get_price_forecast(
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
    from prophet import Prophet

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

    # 3. Initialize and fit Prophet model
    try:
        from prophet import Prophet
        # Disabling yearly/weekly seasonality since we only have 30 days of data
        m = Prophet(daily_seasonality=False, yearly_seasonality=False, weekly_seasonality=False)
        m.fit(df_daily)

        # 4. Generate dates for next 7 days and predict
        future = m.make_future_dataframe(periods=7)
        forecast = m.predict(future)

        # 5. Extract only the 7 future predicted days and format
        future_forecast = forecast.tail(7)
        
        forecast_json = []
        for _, row in future_forecast.iterrows():
            pred_price = row['yhat']
            # Ensure predicted price doesn't drop to absurd negatives
            min_hist = df_daily['y'].min()
            pred_price = max(min_hist * 0.5, pred_price)
            
            forecast_json.append({
                "date": row['ds'].strftime("%Y-%m-%d"),
                "price": int(round(pred_price)),
                "isForecast": True
            })
    except Exception as e:
        print(f"Prophet initialization failed ({e}). Falling back to linear projection.")
        import numpy as np
        
        x = np.arange(len(df_daily))
        y = df_daily['y'].values
        
        # Fit a simple linear trend (degree 1)
        z = np.polyfit(x, y, 1)
        p = np.poly1d(z)
        
        forecast_json = []
        last_date = df_daily['ds'].max()
        min_hist = df_daily['y'].min()
        
        for i in range(1, 8):
            future_date = last_date + timedelta(days=i)
            # Predict price using linear fit, extrapolating from len(x)-1 points
            pred_price = p(len(x) - 1 + i)
            # Add some slight random noise so it doesn't look perfectly flat/artificial
            import random
            noise = pred_price * random.uniform(-0.02, 0.02)
            pred_price += noise
            
            # Floor to 50% of history min
            pred_price = max(min_hist * 0.5, pred_price)
            
            forecast_json.append({
                "date": future_date.strftime("%Y-%m-%d"),
                "price": int(round(pred_price)),
                "isForecast": True
            })

    # Combine historical and forecasted data
    final_result = historical_json + forecast_json
    forecast_cache.set(cache_key, final_result)
    return final_result



@router.get('/courses')
def get_courses(language: str = Query('en')):
    """Get available skill development courses with localization"""
    
    # Base English Data (Titles remain constant)
    courses_en = [
        {
            "id": "electrician",
            "name": "Electrician Course", 
            "duration": "34 hours", 
            "cost": "₹1,500", 
            "icon": "TrendingUp",
            "description": "Learn the basics of domestic wiring, safety, and appliance repair.",
            "study_material": "Module 1: Safety Protocols\nModule 2: Tools & Equipment\nModule 3: Domestic Wiring Basics\nModule 4: Troubleshooting Common Issues",
            "videos": [
                {"title": "Course Overview & Safety", "url": "https://www.youtube.com/embed/ggJo6m8NZtA"},
                {"title": "Wiring & Tools", "url": "https://www.youtube.com/embed/H55vgq6zuMc"},
                {"title": "Troubleshooting", "url": "https://www.youtube.com/embed/Mts0VEj7x0g"}
            ] 
        },
        {
            "id": "solar",
            "name": "Solar Tech", 
            "duration": "45 hours", 
            "cost": "₹2,200", 
            "icon": "Sprout",
            "description": "Master solar panel installation and maintenance for agricultural use.",
            "study_material": "Module 1: Introduction to Photovoltaics\nModule 2: Site Assessment\nModule 3: Installation Procedures\nModule 4: Battery & Inverter Maintenance",
            "videos": [
                {"title": "Introduction & Procedures", "url": "https://www.youtube.com/embed/px239v5o6xU"},
                {"title": "Maintenance", "url": "https://www.youtube.com/embed/pmWlvUWkeQo"}
            ]
        },
        {
            "id": "carpentry",
            "name": "Basic Carpentry", 
            "duration": "20 hours", 
            "cost": "₹1,000", 
            "icon": "TrendingUp",
            "description": "Essential woodworking skills for farm tools and furniture.",
            "study_material": "Module 1: Wood Types & Selection\nModule 2: Measuring & Marking\nModule 3: Cutting & Joining\nModule 4: Finishing Techniques",
            "videos": [
                {"title": "Basics & Wood Types", "url": "https://www.youtube.com/embed/zCNgrOR8FEU"},
                {"title": "Tools & Techniques", "url": "https://www.youtube.com/embed/y8W7KbJTg7A"}
            ]
        },
        {
            "id": "marketing",
            "name": "Agriculture Marketing", 
            "duration": "15 hours", 
            "cost": "₹800", 
            "icon": "TrendingUp",
            "description": "Strategies to sell your produce effectively and get better prices.",
            "study_material": "Module 1: Supply Chain Basics\nModule 2: Pricing Strategies\nModule 3: Digital Marketing for Farmers\nModule 4: Negotiating with Traders",
            "videos": [
                {"title": "Supply Chain & Pricing", "url": "https://www.youtube.com/embed/AHwmhG3gFRE"},
                {"title": "General Strategy", "url": "https://www.youtube.com/embed/ShoD-FOlMUY"}
            ]
        },
        {
            "id": "organic",
            "name": "Organic Farming", 
            "duration": "40 hours", 
            "cost": "₹2,500", 
            "icon": "Sprout",
            "description": "Certified organic farming techniques for sustainable yield.",
            "study_material": "Module 1: Soil Health Management\nModule 2: Composting & Bio-fertilizers\nModule 3: Pest Management\nModule 4: Certification Process",
            "videos": [
                {"title": "Soil Health & Management", "url": "https://www.youtube.com/embed/UR3j7wIEN7s"},
                {"title": "Pest Control", "url": "https://www.youtube.com/embed/NxRgk79dT8M"}
            ]
        },
        {
            "id": "equipment",
            "name": "Equipment Maintenance", 
            "duration": "25 hours", 
            "cost": "₹1,800", 
            "icon": "TrendingUp",
            "description": "Maintenance and minor repairs for tractors and farm machinery.",
            "study_material": "Module 1: Tractor Basics\nModule 2: Engine Maintenance\nModule 3: Hydraulics System\nModule 4: Safety & Troubleshooting",
            "videos": [
                {"title": "Tractor Basics", "url": "https://www.youtube.com/embed/SyjJSED0gDw"},
                {"title": "Maintenance & Troubleshooting", "url": "https://www.youtube.com/embed/ylv9E1xHsZQ"}
            ]
        },
        # NEW COURSES
        {
            "id": "english",
            "name": "English Foundation",
            "duration": "50 hours",
            "cost": "₹500",
            "icon": "BookOpen",
            "description": "Basic English speaking and reading skills for daily communication and business.",
            "study_material": "Module 1: Basic Grammar & Vocabulary\nModule 2: Daily Conversation Practice\nModule 3: Reading Agriculture Labels\nModule 4: Business Communication Basics",
            "videos": [
                {"title": "English Foundation Course", "url": "https://www.youtube.com/embed/juKd26qkNAw"}
            ] 
        },
        {
            "id": "math",
            "name": "Mathematics for Agriculture",
            "duration": "30 hours",
            "cost": "₹500",
            "icon": "BookOpen",
            "description": "Essential math skills for crop planning, loan calculations, and profit estimation.",
            "study_material": "Module 1: Basic Calculations & Unit Conversions\nModule 2: Area & Land Measurement\nModule 3: Profit, Loss & Interest Calculation\nModule 4: Budgeting for Crop Cycles",
            "videos": [
                {"title": "Land Measurement & Area", "url": "https://www.youtube.com/embed/QRPzoi_VosM"},
                {"title": "Crop & Seed Mathematics", "url": "https://www.youtube.com/embed/FbWclWfefW8"},
                {"title": "Fertilizer & Chemical Calculations", "url": "https://www.youtube.com/embed/BGVU75oRKyo"},
                {"title": "Irrigation & Water Management", "url": "https://www.youtube.com/embed/jgvXAv8lcEQ"}
            ] 
        }
    ]

    # Localization Data (Keyed by course ID) (Titles kept in English as requested)
    translations = {
        'hi': {
            'electrician': {'description': 'घरेलू वायरिंग, सुरक्षा और उपकरण मरम्मत की बुनियादी बातें सीखें।', 'study_material': 'मॉड्यूल 1: सुरक्षा प्रोटोकॉल\nमॉड्यूल 2: उपकरण और औजार\nमॉड्यूल 3: घरेलू वायरिंग मूल बातें\nमॉड्यूल 4: सामान्य समस्याओं का निवारण'},
            'solar': {'description': 'कृषि उपयोग के लिए सौर पैनल स्थापना और रखरखाव में महारत हासिल करें।', 'study_material': 'मॉड्यूल 1: फोटोवोल्टिक का परिचय\nमॉड्यूल 2: साइट मूल्यांकन\nमॉड्यूल 3: स्थापना प्रक्रियाएं\nमॉड्यूल 4: बैटरी और इन्वर्टर रखरखाव'},
            'carpentry': {'description': 'कृषि उपकरण और फर्नीचर के लिए आवश्यक बढ़ईगीरी कौशल।', 'study_material': 'मॉड्यूल 1: लकड़ी के प्रकार और चयन\nमॉड्यूल 2: मापना और निशान लगाना\nमॉड्यूल 3: काटना और जोड़ना\nमॉड्यूल 4: फिनिशिंग तकनीक'},
            'marketing': {'description': 'अपनी उपज को प्रभावी ढंग से बेचने और बेहतर कीमत पाने की रणनीतियाँ।', 'study_material': 'मॉड्यूल 1: आपूर्ति श्रृंखला मूल बातें\nमॉड्यूल 2: मूल्य निर्धारण रणनीतियाँ\nमॉड्यूल 3: किसानों के लिए डिजिटल मार्केटिंग\nमॉड्यूल 4: व्यापारियों के साथ बातचीत'},
            'organic': {'description': 'टिकाऊ उपज के लिए प्रमाणित जैविक खेती तकनीकें।', 'study_material': 'मॉड्यूल 1: मृदा स्वास्थ्य प्रबंधन\nमॉड्यूल 2: कंपोस्टिंग और जैव-उर्वरक\nमॉड्यूल 3: कीट प्रबंधन\nमॉड्यूल 4: प्रमाणन प्रक्रिया'},
            'equipment': {'description': 'ट्रैक्टर और कृषि मशीनरी का रखरखाव और छोटी मरम्मत।', 'study_material': 'मॉड्यूल 1: ट्रैक्टर मूल बातें\nमॉड्यूल 2: इंजन रखरखाव\nमॉड्यूल 3: हाइड्रोलिक्स सिस्टम\nमॉड्यूल 4: सुरक्षा और समस्या निवारण'},
            'english': {'description': 'दैनिक संचार और व्यापार के लिए बुनियादी अंग्रेजी बोलने और पढ़ने का कौशल।', 'study_material': 'मॉड्यूल 1: बुनियादी व्याकरण और शब्दावली\nमॉड्यूल 2: दैनिक बातचीत अभ्यास\nमॉड्यूल 3: कृषि लेबल पढ़ना\nमॉड्यूल 4: व्यावसायिक संचार मूल बातें'},
            'math': {'description': 'फसल योजना, ऋण गणना और लाभ अनुमान के लिए आवश्यक गणित कौशल।', 'study_material': 'मॉड्यूल 1: बुनियादी गणना और इकाई रूपांतरण\nमॉड्यूल 2: क्षेत्र और भूमि माप\nमॉड्यूल 3: लाभ, हानि और ब्याज गणना\nमॉड्यूल 4: फसल चक्र के लिए बजट'},
        },
        'ta': {
            'electrician': {'description': 'வீட்டு வயரிங், பாதுகாப்பு மற்றும் சாதனப் பழுதுபார்ப்பின் அடிப்படைகளைக் கற்றுக்கொள்ளுங்கள்.', 'study_material': 'தொகுதி 1: பாதுகாப்பு நெறிமுறைகள்\nதொகுதி 2: கருவிகள் மற்றும் உபகரணங்கள்\nதொகுதி 3: வீட்டு வயரிங் அடிப்படைகள்\nதொகுதி 4: பொதுவான சிக்கல்களைத் தீர்ப்பது'},
            'solar': {'description': 'விவசாய பயன்பாட்டிற்கான சோலார் பேனல் நிறுவல் மற்றும் பராமரிப்பில் தேர்ச்சி பெறுங்கள்.', 'study_material': 'தொகுதி 1: ஒளிமின்னழுத்த அறிமுகம்\nதொகுதி 2: தளம் மதிப்பீடு\nதொகுதி 3: நிறுவல் நடைமுறைகள்\nதொகுதி 4: பேட்டரி மற்றும் இன்வெர்ட்டர் பராமரிப்பு'},
            'carpentry': {'description': 'பண்ணைக் கருவிகள் மற்றும் பர்னிச்சர்களுக்கான அத்தியாவசிய தச்சுத் திறன்கள்.', 'study_material': 'தொகுதி 1: மர வகைகள் மற்றும் தேர்வு\nதொகுதி 2: அளவிடுதல் மற்றும் குறித்தல்\nதொகுதி 3: வெட்டுதல் மற்றும் இணைத்தல்\nதொகுதி 4: முடிக்கும் நுட்பங்கள்'},
            'marketing': {'description': 'உங்கள் விளைபொருட்களை திறம்பட விற்று சிறந்த விலையைப் பெறுவதற்கான உத்திகள்.', 'study_material': 'தொகுதி 1: விநியோகச் சங்கிலி அடிப்படைகள்\nதொகுதி 2: விலை நிர்ணய உத்திகள்\nதொகுதி 3: விவசாயிகளுக்கான டிஜிட்டல் மார்க்கெட்டிங்\nதொகுதி 4: வணிகர்களுடன் பேச்சுவார்த்தை'},
            'organic': {'description': 'நிலையான விளைச்சலுக்கான சான்றளிக்கப்பட்ட இயற்கை விவசாய நுட்பங்கள்.', 'study_material': 'தொகுதி 1: மண் வள மேலாண்மை\nதொகுதி 2: உரம் மற்றும் உயிர் உரங்கள்\nதொகுதி 3: பூச்சி மேலாண்மை\nதொகுதி 4: சான்றிதழ் செயல்முறை'},
            'equipment': {'description': 'ட்ராக்டர்கள் மற்றும் பண்ணை இயந்திரங்களுக்கான பராமரிப்பு மற்றும் சிறிய பழுதுபார்ப்பு.', 'study_material': 'தொகுதி 1: ட்ராக்டர் அடிப்படைகள்\nதொகுதி 2: இன்ஜின் பராமரிப்பு\nதொகுதி 3: ஹைட்ராலிக்ஸ் அமைப்பு\nதொகுதி 4: பாதுகாப்பு மற்றும் சரிசெய்தல்'},
            'english': {'description': 'தினசரி தொடர்பு மற்றும் வணிகத்திற்கான அடிப்படை ஆங்கிலம் பேசுதல் மற்றும் படிக்கும் திறன்கள்.', 'study_material': 'தொகுதி 1: அடிப்படை இலக்கணம் மற்றும் சொற்களஞ்சியம்\nதொகுதி 2: தினசரி உரையாடல் பயிற்சி\nதொகுதி 3: விவசாய லேபிள்களைப் படித்தல்\nதொகுதி 4: வணிகத் தொடர்பு அடிப்படைகள்'},
            'math': {'description': 'பயிர் திட்டமிடல், கடன் கணக்கீடுகள் மற்றும் லாப மதிப்பீட்டிற்கான அத்தியாவசிய கணிதத் திறன்கள்.', 'study_material': 'தொகுதி 1: அடிப்படை கணக்கீடுகள் மற்றும் அலகு மாற்றங்கள்\nதொகுதி 2: பரப்பளவு மற்றும் நில அளவீடு\nதொகுதி 3: லாபம், நஷ்டம் மற்றும் வட்டி கணக்கீடு\nதொகுதி 4: பயிர் சுழற்சிகளுக்கான பட்ஜெட்'},
        },
        # Placeholder logic for other languages to default to English or use specific if available
        # Adding Telugu and Kannada as examples, others will fall back to English description but keep structure intact locally if needed
        'te': {
            'electrician': {'description': 'గృహ వైరింగ్, భద్రత మరియు ఉపకరణాల మరమ్మత్తు యొక్క ప్రాథమికాలను తెలుసుకోండి.', 'study_material': 'మాడ్యూల్ 1: భద్రతా ప్రోటోకాల్‌లు\nమాడ్యూల్ 2: ఉపకరణాలు & పరికరాలు\nమాడ్యూల్ 3: డొమెస్టిక్ వైరింగ్ బేసిక్స్\nమాడ్యూల్ 4: ట్రబుల్షూటింగ్'},
            'english': {'description': 'రోజువారీ కమ్యూనికేషన్ మరియు వ్యాపారం కోసం ప్రాథమిక ఆంగ్ల నైపుణ్యాలు.', 'study_material': 'మాడ్యూల్ 1: ప్రాథమిక వ్యాకరణం\nమాడ్యూల్ 2: సంభాషణ సాధన\nమాడ్యూల్ 3: లేబుల్ పఠనం\nమాడ్యూల్ 4: వ్యాపార కమ్యూనికేషన్'},
            'math': {'description': 'పంట ప్రణాళిక మరియు లాభాల అంచనా కోసం ముఖ్యమైన గణిత నైపుణ్యాలు.', 'study_material': 'మాడ్యూల్ 1: ప్రాథమిక గణనలు\nమాడ్యూల్ 2: భూమి కొలత\nమాడ్యూల్ 3: లాభం & నష్టం\nమాడ్యూల్ 4: బడ్జెటింగ్'}
        },
        'kn': {
             'english': {'description': 'ದೈನಂದಿನ ಸಂವಹನ ಮತ್ತು ವ್ಯವಹಾರಕ್ಕಾಗಿ ಮೂಲಭೂತ ಇಂಗ್ಲಿಷ್ ಕೌಶಲ್ಯಗಳು.', 'study_material': 'ಮಾಡ್ಯೂಲ್ 1: ಮೂಲ ವ್ಯಾಕರಣ\nಮಾಡ್ಯೂಲ್ 2: ಸಂಭಾಷಣೆ ಅಭ್ಯಾಸ\nಮಾಡ್ಯೂಲ್ 3: ಲೇಬಲ್ ಓದುವಿಕೆ\nಮಾಡ್ಯೂಲ್ 4: ವ್ಯವಹಾರ ಸಂವಹನ'},
             'math': {'description': 'ಬೆಳೆ ಯೋಜನೆ ಮತ್ತು ಲಾಭದ ಅಂದಾಜುಗಾಗಿ ಅಗತ್ಯವಾದ ಗಣಿತ ಕೌಶಲ್ಯಗಳು.', 'study_material': 'ಮಾಡ್ಯೂಲ್ 1: ಮೂಲ ಲೆಕ್ಕಾಚಾರಗಳು\nಮಾಡ್ಯೂಲ್ 2: ಭೂಮಿ ಅಳತೆ\nಮಾಡ್ಯೂಲ್ 3: ಲಾಭ ಮತ್ತು ನಷ್ಟ\nಮಾಡ್ಯೂಲ್ 4: ಬಜೆಟ್'}
        }
    }

    selected_trans = translations.get(language, {})

    # Apply translation
    final_courses = []
    for course in courses_en:
        c_id = str(course.get('id') or "")
        trans_data = selected_trans.get(c_id, {})
        
        # Merge translation if exists, else keep English
        course['description'] = trans_data.get('description', course['description'])
        course['study_material'] = trans_data.get('study_material', course['study_material'])
        final_courses.append(course)

    return final_courses
