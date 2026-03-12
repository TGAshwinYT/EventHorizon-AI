import requests
import os
import random
from typing import List, Dict, Any, Optional, Union, Set
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert
from app.models import MandiRate
from app.database import MandiSessionLocal, debug_print

# --- Agmarknet API Config ---
AGMARKNET_API_KEY = os.getenv("AGMARKNET_API_KEY") 
BASE_URL = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"

# We use only the subset of commodities relevant to EventHorizon AI
COMMODITIES = [
    'Tomato', 'Onion', 'Potato', 'Rice', 'Paddy(Dhan)(Common)', 'Wheat', 
    'Maize', 'Cotton', 'Sugarcane', 'Brinjal', 'Cabbage', 'Cauliflower', 
    'Carrot', 'Bhindi(Ladies Finger)', 'Green Chilli', 'Apple', 'Banana', 
    'Mango', 'Orange', 'Pomegranate', 'Grapes'
]

import json
import time

def _format_agmarknet_date(raw_date_str: str) -> str:
    # OGD Agmarknet returns various formats. We want DD/MM/YYYY for our DB.
    try:
        if "-" in raw_date_str:
            dt = datetime.strptime(raw_date_str.split("T")[0], "%Y-%m-%d")
            return dt.strftime("%d/%m/%Y")
        elif "/" in raw_date_str:
            dt = datetime.strptime(raw_date_str.strip(), "%d/%m/%Y")
            return dt.strftime("%d/%m/%Y")
        return raw_date_str
    except Exception:
        return datetime.now().strftime("%d/%m/%Y")

def fetch_agmarknet_mandi_prices(db: Optional[Session] = None, target_date: Optional[str] = None):
    """
    Fetches data from OGD Agmarknet API and stores it in the database.
    """
    close_session = False
    try:
        if not AGMARKNET_API_KEY:
            print("[Agmarknet API] No AGMARKNET_API_KEY found in environment variables. Skipping fetch.")
            return

        print("[Agmarknet API] Starting background fetch...")
        
        if db is None:
            db = MandiSessionLocal()
            close_session = True

        mandi_records_batch = []
        seen_keys = set()
        
        # Suppress insecure request warnings if verify=False is used
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        session = requests.Session()
        session.headers.update({'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        
        total_commodities = len(COMMODITIES)
        print(f"[Agmarknet API] Starting fetch for {total_commodities} commodities.")
        
        consecutive_errors = 0
        for c_idx, crop_name in enumerate(COMMODITIES, 1):
            print(f"\\n[Agmarknet API] [{c_idx}/{total_commodities}] Processing Commodity: {crop_name}")
            
            if consecutive_errors >= 5:
                print(f"[Agmarknet API] Consecutive errors reached limit. Pausing...")
                time.sleep(15)
                consecutive_errors = 0

            # Encode spaces and characters
            import urllib.parse
            encoded_crop = urllib.parse.quote(crop_name)
            api_url = f"{BASE_URL}?api-key={AGMARKNET_API_KEY}&format=json&limit=2000&filters[commodity]={encoded_crop}"
            
            if target_date:
                # OGD usually expects date in DD/MM/YYYY for arrival_date filter
                encoded_date = urllib.parse.quote(target_date)
                api_url += f"&filters[arrival_date]={encoded_date}"
            
            max_retries = 3
            retries = 0
            
            while retries < max_retries:
                try:
                    response = session.get(api_url, timeout=30, verify=False)
                    
                    if response.status_code == 200:
                        consecutive_errors = 0
                        data = response.json()
                        records = data.get("records", [])
                        
                        found_count = 0
                        for record in records:
                            state_name = record.get("state", "Unknown State").title()
                            district = record.get("district", "Unknown District").title()
                            market = record.get("market", "State Aggregated").title()
                            commodity = crop_name
                            variety = record.get("variety", "")
                            
                            raw_date = record.get("arrival_date", "")
                            arrival_date = _format_agmarknet_date(raw_date)
                            
                            if commodity == "Paddy(Dhan)(Common)":
                                commodity = "Rice"
                                
                            key = (state_name, district, market, commodity, arrival_date)
                            if key in seen_keys:
                                continue
                            seen_keys.add(key)
                            
                            try:
                                raw_min = record.get("min_price")
                                raw_max = record.get("max_price")
                                raw_modal = record.get("modal_price")

                                if raw_min is None or raw_max is None or raw_modal is None:
                                    continue

                                min_price = int(float(raw_min))
                                max_price = int(float(raw_max))
                                modal_price = int(float(raw_modal))

                                if modal_price <= 0:
                                    continue

                                mandi_records_batch.append({
                                    "state": state_name,
                                    "district": district,
                                    "market": market,
                                    "commodity": commodity,
                                    "variety": variety,
                                    "arrival_date": arrival_date,
                                    "min_price": min_price,
                                    "max_price": max_price,
                                    "modal_price": modal_price
                                })
                                found_count += 1
                            except (ValueError, TypeError):
                                continue
                        
                        print(f"  > Success! Fetched {len(records)} raw records, added {found_count} valid records.")
                        break
                            
                    elif response.status_code == 429:
                        print(f"  > [Agmarknet API] Rate Limit. Retrying in 10s...")
                        time.sleep(10)
                        retries += 1
                        
                    else:
                        print(f"  > FAILED (Status {response.status_code})")
                        consecutive_errors += 1
                        break
                        
                except requests.exceptions.Timeout:
                    print("  > Timeout. Retrying...")
                    time.sleep(5)
                    retries += 1
                except Exception as e:
                    print(f"  > Error: {e}. Retrying...")
                    time.sleep(5)
                    retries += 1
            
            time.sleep(0.5)

        print(f"\\n[Agmarknet API] Finished fetching. Total valid records batched: {len(mandi_records_batch)}")
        
        if mandi_records_batch:
            print("[Agmarknet API] Executing bulk upsert...")
            stmt = insert(MandiRate).values(mandi_records_batch)
            
            try:
                upsert_stmt = stmt.on_conflict_do_update(
                    constraint="uix_market_commodity_date", 
                    set_={
                        "min_price": stmt.excluded.min_price,
                        "max_price": stmt.excluded.max_price,
                        "modal_price": stmt.excluded.modal_price,
                        "variety": stmt.excluded.variety,
                        "updated_at": datetime.utcnow()
                    },
                    where=(stmt.excluded.modal_price > 0)
                )
                db.execute(upsert_stmt)
            except Exception as db_e:
                print(f"[Agmarknet API] Default constraint failed: {db_e}. Falling back to 'uix_mandi_rate'...")
                db.rollback()
                upsert_stmt_fallback = stmt.on_conflict_do_update(
                    constraint="uix_mandi_rate", 
                    set_={
                        "min_price": stmt.excluded.min_price,
                        "max_price": stmt.excluded.max_price,
                        "modal_price": stmt.excluded.modal_price,
                        "variety": stmt.excluded.variety,
                        "updated_at": datetime.utcnow()
                    },
                    where=(stmt.excluded.modal_price > 0)
                )
                db.execute(upsert_stmt_fallback)
                
            db.commit()
            print("[Agmarknet API] Bulk upsert successful.")
        
        from sqlalchemy import text
        print("[Agmarknet API] Executing 35-day rolling cleanup...")
        cleanup_query = text("""
            DELETE FROM mandi_rates 
            WHERE to_date(arrival_date, 'DD/MM/YYYY') < (CURRENT_DATE - INTERVAL '35 days')
        """)
        result = db.execute(cleanup_query)
        db.commit()
        print(f"[Agmarknet API] Cleanup complete. Removed {result.rowcount} outdated records.")

    except Exception as e:
        print(f"[Agmarknet API] CRITICAL FAILURE: {e}")
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
