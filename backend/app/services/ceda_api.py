import requests
import os
import random
from typing import List, Dict, Any, Optional, Union, Set
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert
from app.models import MandiRate
from app.database import MandiSessionLocal, debug_print

# --- CEDA Mappings ---
# We use only the subset of commodities relevant to EventHorizon AI
CEDA_API_KEY = os.getenv("CEDA_API_KEY") 
BASE_URL = "https://api.ceda.ashoka.edu.in/v1/agmarknet/prices"

COMMODITY_NAME_TO_ID = {
    'Tomato': 78, 'Onion': 23, 'Potato': 24, 'Rice': 3, 'Paddy(Dhan)(Common)': 2, 'Wheat': 1, 
    'Maize': 4, 'Cotton': 15, 'Sugarcane': 150, 'Brinjal': 35, 'Cabbage': 154, 'Cauliflower': 34, 
    'Carrot': 153, 'Bhindi(Ladies Finger)': 85, 'Green Chilli': 87, 'Apple': 17, 'Banana': 19, 
    'Mango': 20, 'Orange': 18, 'Pomegranate': 190, 'Grapes': 22
}

import json

# For states and districts, we'll load from the generated file or static mappings if we want, 
# but for robust code, we'll keep the full dictionaries we generated in the same directory.
try:
    from backend.ceda_mappings import STATE_ID_TO_NAME, DISTRICT_ID_TO_NAME
except ImportError:
    # If the import fails (e.g. running from a different working directory), we'll do a local fallback or try another path
    try:
        from ceda_mappings import STATE_ID_TO_NAME, DISTRICT_ID_TO_NAME
    except ImportError:
        # Extreme fallback
        STATE_ID_TO_NAME = {}
        DISTRICT_ID_TO_NAME = {}

# Convert CEDA API date format to our DB format
def _format_ceda_date(iso_date_str: str) -> str:
    # CEDA returns: "2024-03-01T00:00:00.000Z"
    try:
        dt = datetime.strptime(iso_date_str.split("T")[0], "%Y-%m-%d")
        return dt.strftime("%d/%m/%Y")
    except Exception:
        return datetime.now().strftime("%d/%m/%Y")

def fetch_ceda_mandi_prices(db: Optional[Session] = None, target_date: Optional[str] = None):
    """
    Fetches data from CEDA-AMD API and stores it in the database.
    """
    import time
    try:
        if not CEDA_API_KEY:
            print("[CEDA API] No CEDA_API_KEY found in environment variables. Skipping fetch.")
            return

        print("[CEDA API] Starting background fetch...")
        
        headers = {
            "Authorization": f"Bearer {CEDA_API_KEY}",
            "Content-Type": "application/json"
        }
        
        close_session = False
        if db is None:
            db = MandiSessionLocal()
            close_session = True

        try:
            days_to_fetch = 1 if target_date else 5
            to_date = target_date if target_date else datetime.now().strftime("%Y-%m-%d")
            
            if target_date:
                try:
                    dt = datetime.strptime(target_date, "%d/%m/%Y")
                    to_date = dt.strftime("%Y-%m-%d")
                    from_date = (dt - timedelta(days=1)).strftime("%Y-%m-%d")
                except:
                    to_date = datetime.now().strftime("%Y-%m-%d")
                    from_date = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
            else:
                 from_date = (datetime.now() - timedelta(days=days_to_fetch)).strftime("%Y-%m-%d")

            mandi_records_batch = []
            seen_keys = set()
            
            for crop_name, crop_id in COMMODITY_NAME_TO_ID.items():
                for state_id, state_name in STATE_ID_TO_NAME.items():
                    print(f"[CEDA API] Fetching {crop_name} (ID: {crop_id}) for {state_name} (ID: {state_id})...")
                    
                    # FORCE integers for IDs, and provide both date naming conventions 
                    # just in case the API is looking for the old from_date format
                    payload = {
                        "commodity_id": int(crop_id),
                        "state_id": int(state_id),
                        "start_date": from_date,
                        "end_date": to_date,
                        "from_date": from_date,
                        "to_date": to_date
                    }
                    
                    # The vital retry loop for 429 Rate Limits
                    max_retries = 3
                    retries = 0
                    
                    while retries < max_retries:
                        try:
                            response = requests.post(BASE_URL, headers=headers, json=payload, timeout=30)
                            
                            if response.status_code == 200:
                                data = response.json()
                                records = data.get("output", {}).get("data", [])
                                
                                for record in records:
                                    district_id = record.get("census_district_id")
                                    
                                    district_name = DISTRICT_ID_TO_NAME.get(district_id, "Unknown District") if district_id else "Unknown District"
                                    market = f"{district_name} (Aggregated)" if district_name != "Unknown District" else "State Aggregated"
                                    district = district_name
                                    commodity = crop_name
                                    variety = ""
                                    
                                    raw_date = record.get("date", "")
                                    arrival_date = _format_ceda_date(raw_date)
                                    
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
                                    except (ValueError, TypeError):
                                        continue
                                
                                break # Success! Break out of the retry loop.
                                    
                            elif response.status_code == 429:
                                print(f"[CEDA API] Warning: 429 Too Many Requests. Sleeping for 20 seconds...")
                                time.sleep(30)
                                retries += 1
                                continue # Try the exact same request again
                                
                            elif response.status_code == 404:
                                break # No data for this state/crop, move on safely
                                
                            else:
                                print(f"[CEDA API] Warning: API returned status {response.status_code} for Crop {crop_id}, State {state_id}")
                                print(f"[CEDA API] Response text: {response.text}")
                                break # Break on 400 bad request, no point retrying
                                
                        except requests.exceptions.Timeout:
                            print(f"[CEDA API] Timeout fetching {crop_name}. Sleeping and retrying...")
                            time.sleep(10)
                            retries += 1
                        except Exception as e:
                            print(f"[CEDA API] Error fetching {crop_name}: {e}. Retrying...")
                            time.sleep(10)
                            retries += 1
                    
                    # Sleep slightly between successful state requests to avoid triggering the 429 limit
                    time.sleep(4.0)
                
            print(f"[CEDA API] Finished fetching. Total valid records batched: {len(mandi_records_batch)}")
            
            if mandi_records_batch:
                print("[CEDA API] Executing bulk upsert...")
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
                    print(f"[CEDA API] Default constraint 'uix_market_commodity_date' failed: {db_e}. Falling back to 'uix_mandi_rate'...")
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
                print("[CEDA API] Bulk upsert successful.")
            
            # --- 5-DAY ROLLING WINDOW CLEANUP ---
            from sqlalchemy import text
            print("[CEDA API] Executing 5-day rolling cleanup...")
            cleanup_query = text("""
                DELETE FROM mandi_rates 
                WHERE to_date(arrival_date, 'DD/MM/YYYY') < (CURRENT_DATE - INTERVAL '5 days')
            """)
            result = db.execute(cleanup_query)
            db.commit()
            print(f"[CEDA API] Cleanup complete. Removed {result.rowcount} outdated records (Older than 5 days).")

        finally:
            if close_session:
                db.close()
    except Exception as e:
        print(f"[CEDA API] CRITICAL FAILURE: {e}")


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

    return {
        "current_price": f"₹{int(avg_modal):,}",
        "price_unit": "per quintal",
        "change": change_str,
        "market": f"{crop} - {state}{' - ' + district if district and district != 'All Districts' else ''}",
        "history": history,
        "recent_data": recent_data,
        "min_price": f"₹{int(all_min):,}",
        "max_price": f"₹{int(all_max):,}"
    }

# Ensure backwards compatibility for external scripts that might import `fetch_ogd_mandi_prices`
fetch_ogd_mandi_prices = fetch_ceda_mandi_prices

