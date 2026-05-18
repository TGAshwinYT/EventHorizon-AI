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
    Replaces OGD data fetcher. Optimized for no state loop and bulk insert.
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
                print(f"[CEDA API] Fetching {crop_name} (ID: {crop_id}) from {from_date} to {to_date}...")
                
                payload = {
                    "commodity_id": crop_id,
                    "from_date": from_date,
                    "to_date": to_date
                }
                
                while True:
                    try:
                        response = requests.post(BASE_URL, headers=headers, json=payload, timeout=30)
                        if response.status_code == 200:
                            data = response.json()
                            records = data.get("output", {}).get("data", [])
                            
                            for record in records:
                                state_id = record.get("census_state_id")
                                district_id = record.get("census_district_id")
                                
                                state = STATE_ID_TO_NAME.get(state_id, "Unknown") if state_id else "Unknown"
                                district_name = DISTRICT_ID_TO_NAME.get(district_id, "Unknown") if district_id else "Unknown District"
                                market = f"{district_name} (Aggregated)" if district_name != "Unknown District" else "State Aggregated"
                                district = district_name
                                commodity = crop_name
                                variety = ""
                                
                                raw_date = record.get("date", "")
                                arrival_date = _format_ceda_date(raw_date)
                                
                                if commodity == "Paddy(Dhan)(Common)":
                                    commodity = "Rice"
                                    
                                key = (state, district, market, commodity, arrival_date)
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
                                        "state": state,
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
                            break # Success, break retry loop
                            
                        elif response.status_code == 429:
                            print(f"[CEDA API] Warning: 429 Too Many Requests. Sleeping for 15 seconds and retrying {crop_name}...")
                            time.sleep(15)
                            continue
                        elif response.status_code == 404:
                            break # No data, next crop
                        else:
                            print(f"[CEDA API] Warning: API returned status {response.status_code} for Crop {crop_id}")
                            print(f"[CEDA API] Response text: {response.text}")
                            break
                            
                    except requests.exceptions.Timeout:
                        print(f"[CEDA API] Timeout fetching {crop_name}. Retrying in 15 seconds...")
                        time.sleep(15)
                        continue
                    except Exception as e:
                        print(f"[CEDA API] Error fetching {crop_name}: {e}. Retrying in 15 seconds...")
                        time.sleep(15)
                        continue
                
                # Sleep between each crop iteration
                time.sleep(2)
                
            print(f"[CEDA API] Finished fetching. Total valid records batched: {len(mandi_records_batch)}")
            
            if mandi_records_batch:
                print("[CEDA API] Executing bulk upsert...")
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

    # High-Performance O(N) 1-pass Daily Stats compiler
    daily_stats = {}
    data_by_date = {} # Keep for backward compatibility with table/recent lists
    for r in records:
        d_obj = parse_date(r.arrival_date)
        if d_obj == datetime.min: continue
        
        date_key = d_obj.strftime("%Y-%m-%d")
        if date_key not in daily_stats:
            daily_stats[date_key] = {"sum": 0.0, "count": 0, "min": float('inf'), "max": float('-inf')}
            data_by_date[date_key] = []
            
        stats = daily_stats[date_key]
        stats["sum"] += r.modal_price
        stats["count"] += 1
        data_by_date[date_key].append(r)
        
        if r.min_price > 0:
            stats["min"] = min(stats["min"], r.min_price)
        if r.max_price > 0:
            stats["max"] = max(stats["max"], r.max_price)

    sorted_dates = sorted(daily_stats.keys())
    if not sorted_dates:
         return {
            "current_price": "N/A",
            "price_unit": "per quintal",
            "change": "-",
            "market": f"{crop} - {state}{' - ' + district if district and district != 'All Districts' else ''} (No Data)",
            "history": [],
            "recent_data": []
        }

    # 1. Current Price (Latest Date) using pre-aggregated O(1) sum/count
    latest_date_key = sorted_dates[-1]
    latest_stats = daily_stats[latest_date_key]
    avg_modal = latest_stats["sum"] / latest_stats["count"]
    
    # 2. Change (Compare with Previous Day if exists) in O(1)
    change_pct = 0.0
    if len(sorted_dates) > 1:
        prev_date_key = sorted_dates[-2]
        prev_stats = daily_stats[prev_date_key]
        prev_avg = prev_stats["sum"] / prev_stats["count"]
        if prev_avg > 0:
            change_pct = ((avg_modal - prev_avg) / prev_avg) * 100

    change_str = f"{change_pct:+.1f}%"

    # Pre-calculate high-performance EMA across sorted_dates in O(N)
    ema_values = {}
    alpha = 0.35 # Standard smoothing coefficient
    current_ema = 0.0
    for idx, d_key in enumerate(sorted_dates):
        d_stats = daily_stats[d_key]
        day_avg = d_stats["sum"] / d_stats["count"]
        if idx == 0:
            current_ema = day_avg
        else:
            current_ema = (day_avg * alpha) + (current_ema * (1 - alpha))
        ema_values[d_key] = current_ema

    # 3. History (Last 7 Days from Today) built in O(H) using pre-computed O(1) EMA values
    history = []
    today = datetime.now()
    history_keys = [(today - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(6, -1, -1)]
    
    last_known_ema = avg_modal
    last_known_min = latest_stats["min"] if latest_stats["min"] != float('inf') else 0
    last_known_max = latest_stats["max"] if latest_stats["max"] != float('-inf') else 0

    # Backfill with first date if we need static start padding
    first_date_key = sorted_dates[0]
    first_stats = daily_stats[first_date_key]
    fallback_ema = ema_values[first_date_key]
    fallback_min = first_stats["min"] if first_stats["min"] != float('inf') else 0
    fallback_max = first_stats["max"] if first_stats["max"] != float('-inf') else 0

    # Build continuous O(1) history line
    for d_key in history_keys:
        d_obj = datetime.strptime(d_key, "%Y-%m-%d")
        if d_key in daily_stats:
            last_known_ema = ema_values[d_key]
            last_known_min = daily_stats[d_key]["min"] if daily_stats[d_key]["min"] != float('inf') else fallback_min
            last_known_max = daily_stats[d_key]["max"] if daily_stats[d_key]["max"] != float('-inf') else fallback_max
        else:
            # Check if this date falls before any data exists
            if d_key < first_date_key:
                last_known_ema = fallback_ema
                last_known_min = fallback_min
                last_known_max = fallback_max
            # Otherwise it retains last_known (which propagates forward)

        history.append({
            "date": d_obj.strftime("%d %b"),
            "price": int(last_known_ema),
            "min": int(last_known_min),
            "max": int(last_known_max)
        })

    # 4. Recent Data for Table (Show top market from the last 5 days) in O(K * M)
    recent_data = []
    recent_dates = sorted_dates[-5:]
    recent_dates.reverse()
    
    for d_key in recent_dates:
        day_records = data_by_date[d_key]
        if not day_records: continue
        
        # Pick the market with highest modal price in O(M)
        market_record = max(day_records, key=lambda x: x.modal_price)
        d_obj = datetime.strptime(d_key, "%Y-%m-%d")
        
        recent_data.append({
            "date": d_obj.strftime("%d %b"),
            "min": market_record.min_price,
            "max": market_record.max_price,
            "modal": market_record.modal_price
        })

    # Global min/max of entire dataset in O(1) by scanning our fast stats hash map
    all_min = min((s["min"] for s in daily_stats.values() if s["min"] != float('inf')), default=0)
    all_max = max((s["max"] for s in daily_stats.values() if s["max"] != float('-inf')), default=0)

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
