import requests
import os
import time
from typing import List, Dict, Any, Optional, Union, Set
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert
from app.models import MandiRate
from app.database import MandiSessionLocal, debug_print

# --- Agmarknet API Config ---
AGMARKNET_API_KEY = os.getenv("AGMARKNET_API_KEY") or os.getenv("DATAGOV_API_KEY") or os.getenv("OGD_API_KEY")
BASE_URL = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"

# Configuration for robustness
MAX_WORKERS = 3     # Parallel workers - kept low to avoid rate limits
TIMEOUT = 60        # Seconds
MAX_RETRIES = 3     # Retries per commodity
RETRY_DELAY = 5     # Base delay for backoff

# Expanded list of commodities relevant to rural Indian farmers
COMMODITIES = [
    'Tomato', 'Onion', 'Potato', 'Rice', 'Paddy(Dhan)(Common)', 'Wheat', 
    'Maize', 'Cotton', 'Sugarcane', 'Brinjal', 'Cabbage', 'Cauliflower', 
    'Carrot', 'Bhindi(Ladies Finger)', 'Green Chilli', 'Apple', 'Banana', 
    'Mango', 'Orange', 'Pomegranate', 'Grapes', 'Bitter Gourd', 'Bottle Gourd',
    'Garlic', 'Ginger', 'Turmeric', 'Papaya', 'Lemon', 'Coconut'
]

def _format_agmarknet_date(raw_date_str: str):
    """Helper to ensure dates are parsed as datetime.date objects for our Postgres DB."""
    try:
        if "-" in raw_date_str:
            dt = datetime.strptime(raw_date_str.split("T")[0], "%Y-%m-%d")
            return dt.date()
        elif "/" in raw_date_str:
            parts = raw_date_str.strip().split("/")
            if len(parts[0]) == 4:
                dt = datetime.strptime(raw_date_str.strip(), "%Y/%m/%d")
            else:
                dt = datetime.strptime(raw_date_str.strip(), "%d/%m/%Y")
            return dt.date()
        # Fallback parsing
        dt = datetime.strptime(raw_date_str.strip(), "%Y-%m-%d")
        return dt.date()
    except Exception:
        return datetime.now().date()

def _fetch_single_commodity(commodity: str, date: str, session: requests.Session) -> List[Dict[str, Any]]:
    """Fetch all records for one commodity on one date with retries and backoff."""
    params = {
        "api-key": AGMARKNET_API_KEY,
        "format": "json",
        "limit": "2000",
        "filters[commodity]": commodity,
        "filters[arrival_date]": date,
    }

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = session.get(BASE_URL, params=params, timeout=TIMEOUT, verify=False)
            if response.status_code == 200:
                data = response.json()
                return data.get("records", [])
            elif response.status_code == 429:
                wait = 10 * attempt
                time.sleep(wait)
            else:
                break # Non-retryable error
        except (requests.exceptions.Timeout, requests.exceptions.ConnectionError):
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY * attempt)
        except Exception:
            break
    return []

def fetch_agmarknet_mandi_prices(db: Optional[Session] = None, target_date: Optional[str] = None):
    """
    Fetches data from OGD Agmarknet API using a robust parallel strategy.
    Tries today's date first, falls back to yesterday if no data is found.
    """
    if not AGMARKNET_API_KEY:
        print("[Agmarknet API] No API Key. Skipping fetch.")
        return

    close_session = False
    if db is None:
        db = MandiSessionLocal()
        close_session = True

    # Suppress insecure request warnings if verify=False is used
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    
    # Dates to try
    if target_date:
        dates_to_try = [target_date]
    else:
        today = datetime.now().strftime("%d/%m/%Y")
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%d/%m/%Y")
        dates_to_try = [today, yesterday]

    try:
        session = requests.Session()
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        })
        
        mandi_records_batch = []
        seen_keys = set()
        successful_date = None

        for date in dates_to_try:
            print(f"[Agmarknet API] Attempting fetch for date: {date}")
            date_records_count = 0
            failed_crops = []

            with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
                futures = {executor.submit(_fetch_single_commodity, crop, date, session): crop for crop in COMMODITIES}
                
                for future in as_completed(futures):
                    crop_name = futures[future]
                    records = future.result()
                    
                    if not records:
                        failed_crops.append(crop_name)
                        continue

                    for record in records:
                        try:
                            state_name = record.get("state", "Unknown State").title()
                            district = record.get("district", "Unknown District").title()
                            market = record.get("market", "State Aggregated").title()
                            commodity = crop_name
                            
                            # Standardize Rice naming
                            if commodity == "Paddy(Dhan)(Common)":
                                commodity = "Rice"
                            
                            arrival_date = _format_agmarknet_date(record.get("arrival_date", ""))
                            
                            key = (state_name, district, market, commodity, arrival_date)
                            if key in seen_keys: continue
                            seen_keys.add(key)

                            raw_min = record.get("min_price")
                            raw_max = record.get("max_price")
                            raw_modal = record.get("modal_price")

                            if raw_min is None or raw_max is None or raw_modal is None:
                                continue

                            mandi_records_batch.append({
                                "state": state_name,
                                "district": district,
                                "market": market,
                                "commodity": commodity,
                                "variety": record.get("variety", ""),
                                "arrival_date": arrival_date,
                                "min_price": int(float(raw_min)),
                                "max_price": int(float(raw_max)),
                                "modal_price": int(float(raw_modal))
                            })
                            date_records_count += 1
                        except (ValueError, TypeError):
                            continue
            
            if date_records_count > 0:
                print(f"[Agmarknet API] [OK] Successfully fetched {date_records_count} records for {date}")
                successful_date = date
                
        # Sequential retry for failed crops if we have some data for this date
        if failed_crops and successful_date:
            print(f"[Agmarknet API] Retrying {len(failed_crops)} failed crops sequentially...")
            for crop in failed_crops:
                time.sleep(1) # Small gap
                records = _fetch_single_commodity(crop, successful_date, session)
                if records:
                    for record in records:
                        try:
                            state_name = record.get("state", "Unknown State").title()
                            district = record.get("district", "Unknown District").title()
                            market = record.get("market", "State Aggregated").title()
                            commodity = crop
                            if commodity == "Paddy(Dhan)(Common)": commodity = "Rice"
                            arrival_date = _format_agmarknet_date(record.get("arrival_date", ""))
                            
                            key = (state_name, district, market, commodity, arrival_date)
                            if key in seen_keys: continue
                            seen_keys.add(key)

                            raw_min = record.get("min_price")
                            raw_max = record.get("max_price")
                            raw_modal = record.get("modal_price")
                            if raw_min is None or raw_max is None or raw_modal is None: continue

                            mandi_records_batch.append({
                                "state": state_name,
                                "district": district,
                                "market": market,
                                "commodity": commodity,
                                "variety": record.get("variety", ""),
                                "arrival_date": arrival_date,
                                "min_price": int(float(raw_min)),
                                "max_price": int(float(raw_max)),
                                "modal_price": int(float(raw_modal))
                            })
                        except (ValueError, TypeError):
                            continue
                break # We got data for a date, stop trying older dates
            else:
                print(f"[Agmarknet API] [WARNING] No data found for {date}.")

        if mandi_records_batch:
            print(f"[Agmarknet API] Executing bulk upsert for {len(mandi_records_batch)} records...")
            stmt = insert(MandiRate).values(mandi_records_batch)
            upsert_stmt = stmt.on_conflict_do_update(
                index_elements=["state", "district", "market", "commodity", "variety", "arrival_date"],
                set_={
                    "min_price": stmt.excluded.min_price,
                    "max_price": stmt.excluded.max_price,
                    "modal_price": stmt.excluded.modal_price,
                    "variety": stmt.excluded.variety
                },
                where=(stmt.excluded.modal_price > 0)
            )
            db.execute(upsert_stmt)
            db.commit()
            print("[Agmarknet API] [OK] Bulk upsert successful.")

        # Cleanup: 35-day rolling window
        from sqlalchemy import text
        cleanup_query = text("""
            DELETE FROM mandi_prices 
            WHERE arrival_date < (CURRENT_DATE - INTERVAL '35 days')
        """)
        db.execute(cleanup_query)
        db.commit()
        print("[Agmarknet API] Cleanup complete.")

    except Exception as e:
        print(f"[Agmarknet API] CRITICAL FAILURE: {e}")
        db.rollback()
    finally:
        if close_session:
            db.close()


def get_mandi_data_from_db(db: Session, crop: str, state: str, district: Optional[str] = None):
    """
    Retrieves aggregated data from DB for the UI using REAL data.
    """
    # Fetch all records for this crop and state (optimized since we cleanup > 7 days)
    if crop == "Rice":
        query = db.query(MandiRate).filter(
            MandiRate.state == state, 
            MandiRate.commodity.in_(["Rice", "Paddy(Dhan)(Common)"])
        )
    else:
        query = db.query(MandiRate).filter(
            MandiRate.state == state, 
            MandiRate.commodity == crop
        )
        
    if district and district != "All Districts":
        query = query.filter(MandiRate.district == district)
        
    records = query.all()
    
    if not records:
        return {
            "current_price": "N/A",
            "price_unit": "per quintal",
            "change": "-",
            "market": f"{crop} - {state}{' - ' + district if district and district != 'All Districts' else ''} (No Data)",
            "history": [],
            "recent_data": []
        }
    def parse_date(date_str):
        try:
            return datetime.strptime(date_str, "%d/%m/%Y")
        except:
             return datetime.min

    # Group by Date
    data_by_date: Dict[str, List[MandiRate]] = {}
    for r in records:
        d_obj = parse_date(r.arrival_date)
        if d_obj == datetime.min: continue # Skip invalid dates
        
        date_key = d_obj.strftime("%Y-%m-%d") # Sortable string key
        if date_key not in data_by_date:
            data_by_date[date_key] = []
        data_by_date[date_key].append(r)

    # Sort dates
    sorted_dates = sorted(data_by_date.keys())
    if not sorted_dates:
         return {
            "current_price": "N/A",
            "price_unit": "per quintal",
            "change": "-",
            "market": f"{crop} - {state}{' - ' + district if district and district != 'All Districts' else ''} (No Data)",
            "history": [],
            "recent_data": []
        }

    # 1. Current Price (Latest Date)
    latest_date_key = sorted_dates[-1]
    latest_records = data_by_date[latest_date_key]
    
    # Average Modal Price for the state
    avg_modal = sum(r.modal_price for r in latest_records) / len(latest_records)
    
    # 2. Change (Compare with Previous Day if exists)
    change_pct = 0.0
    if len(sorted_dates) > 1:
        prev_date_key = sorted_dates[-2]
        prev_records = data_by_date[prev_date_key]
        prev_avg = sum(r.modal_price for r in prev_records) / len(prev_records)
        
        if prev_avg > 0:
            change_pct = ((avg_modal - prev_avg) / prev_avg) * 100

    # Format Change String
    change_str = f"{change_pct:+.1f}%"

    # 3. History (Last 7 Days from Today)
    history: List[Dict[str, Any]] = []
    today = datetime.now()
    # Generate last 7 days keys (Y-M-D for matching)
    history_keys = [(today - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(6, -1, -1)]
    
    last_known_avg = 0
    last_known_min = 0
    last_known_max = 0
    
    # Pre-calculate first known if we have gap at start
    first_date_with_data = sorted_dates[0] if sorted_dates else None
    if first_date_with_data:
        d_rec = data_by_date[first_date_with_data]
        last_known_avg = sum(r.modal_price for r in d_rec) / len(d_rec)
        last_known_min = min(r.min_price for r in d_rec)
        last_known_max = max(r.max_price for r in d_rec)

    for d_key in history_keys:
        d_obj = datetime.strptime(d_key, "%Y-%m-%d")
        if d_key in data_by_date:
            day_records = data_by_date[d_key]
            day_avg = sum(r.modal_price for r in day_records) / len(day_records)
            day_min = min(r.min_price for r in day_records)
            day_max = max(r.max_price for r in day_records)
            
            last_known_avg = day_avg
            last_known_min = day_min
            last_known_max = day_max
        
        # We append a point even if it's "last known" to keep the line continuous
        # If we have absolutely no data EVER, it will be 0
        history.append({
            "date": d_obj.strftime("%d %b"),
            "price": int(last_known_avg),
            "min": int(last_known_min),
            "max": int(last_known_max)
        })

    # 4. Recent Data for Table (Show top market from the last 5 days)
    recent_data: List[Dict[str, Any]] = []
    
    recent_dates = sorted_dates[-5:]
    recent_dates.reverse() # Show newest first
    
    for d_key in recent_dates:
        day_records = data_by_date[d_key]
        if not day_records: continue
        
        # Pick the market with the highest modal price for that day
        market_record = max(day_records, key=lambda x: x.modal_price)
        d_obj = datetime.strptime(d_key, "%Y-%m-%d")
        
        recent_data.append({
                "date": d_obj.strftime("%d %b"),
                "min": market_record.min_price,
                "max": market_record.max_price,
                "modal": market_record.modal_price
            })
            
    # Calculate global min/max for the entire dataset requested
    all_min = min((r.min_price for r in records if r.min_price > 0), default=0)
    all_max = max((r.max_price for r in records if r.max_price > 0), default=0)

    # Calculate "Last Known Good" metadata
    latest_dt = datetime.strptime(latest_date_key, "%Y-%m-%d")
    today_dt = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    days_ago = (today_dt - latest_dt).days
    is_historical = days_ago > 0

    return {
        "current_price": int(avg_modal),
        "price_unit": "per quintal",
        "change": change_str,
        "market": f"{crop} - {state}{' - ' + district if district and district != 'All Districts' else ''}",
        "history": history,
        "recent_data": recent_data,
        "min_price": all_min,
        "max_price": all_max,
        "is_historical": is_historical,
        "last_updated_days_ago": max(0, days_ago)
    }

# Ensure backwards compatibility for external scripts that might import `fetch_ogd_mandi_prices`
fetch_ogd_mandi_prices = fetch_agmarknet_mandi_prices
fetch_ceda_mandi_prices = fetch_agmarknet_mandi_prices
