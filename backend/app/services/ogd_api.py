import requests
import os
import random
from typing import List, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert
from app.models import MandiRate
from app.database import MandiSessionLocal

OGD_API_KEY = os.getenv("OGD_API_KEY") or os.getenv("AGMARKNET_API_KEY")
BASE_URL = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"

def fetch_ogd_mandi_prices(db: Session = None, target_date: str = None):
    """
    Fetches data from Data.gov.in OGD API and stores it in the database.
    Replaces direct Agmarknet data fetcher for better stability.
    """
    try:
        if not OGD_API_KEY:
            print("[OGD API] No OGD API Key found. Skipping fetch.")
            return

        print("[OGD API] Starting background fetch...")
        
        # We fetch data for a few key commodities to keep it manageable
        commodities = [
            'Tomato', 'Onion', 'Potato', 'Rice', 'Paddy(Dhan)(Common)', 'Wheat', 'Maize', 'Cotton', 'Sugarcane',
            'Brinjal', 'Cabbage', 'Cauliflower', 'Carrot', 'Bhindi(Ladies Finger)', 'Green Chilli',
            'Apple', 'Banana', 'Mango', 'Orange', 'Pomegranate', 'Grapes'
        ]
        
        close_session = False
        if db is None:
            db = MandiSessionLocal()
            close_session = True

        try:
            for crop in commodities:
                try:
                    days_to_fetch = 1 if target_date else 7
                    for i in range(days_to_fetch):
                        current_date = target_date if target_date else (datetime.now() - timedelta(days=i)).strftime("%d/%m/%Y")
                        offset = 0
                        total_processed = 0
                        while True:
                            params = {
                                "api-key": OGD_API_KEY,
                                "format": "json",
                                "filters[commodity]": crop,
                                "filters[arrival_date]": current_date,
                                "limit": 500,  # OGD limitation requirement by user
                                "offset": offset
                            }
                            
                            try:
                                response = requests.get(BASE_URL, params=params, timeout=30)
                                if response.status_code == 200:
                                    data = response.json()
                                    records = data.get("records", [])
                                    seen_keys = set()
                                    
                                    for record in records:
                                        process_ogd_record(db, record, crop, seen_keys)
                                        
                                    if records:
                                        try:
                                            db.commit()
                                        except Exception as e:
                                            db.rollback()
                                            print(f"[OGD API] DB Commit Error: {e}")
                                        total_processed += len(records)
                                        
                                    if len(records) < 500 or total_processed >= 2000:
                                        break
                                    offset += 500
                                else:
                                    print(f"[OGD API] Warning: API returned status {response.status_code}")
                                    break
                            except requests.exceptions.Timeout:
                                print(f"[OGD API] Timeout fetching {crop} on {current_date}")
                                break
                            except Exception as e:
                                print(f"[OGD API] Error fetching {crop} on {current_date}: {e}")
                                break
                        print(f"[OGD API] Processed {total_processed} records for {crop} (All India) on {current_date}")
                except Exception as e:
                    print(f"[OGD API] Error processing {crop}: {e}")
            
            # --- ROLLING WINDOW CLEANUP ---
            from sqlalchemy import text
            print("[OGD API] Running 30-day rolling window cleanup...")
            cleanup_query = text("DELETE FROM mandi_rates WHERE updated_at < NOW() - INTERVAL '30 days'")
            result = db.execute(cleanup_query)
            db.commit()
            print(f"[OGD API] Cleanup complete. Deleted {result.rowcount} old records.")

        finally:
            if close_session:
                db.close()
    except Exception as e:
        print(f"[OGD API] CRITICAL FAILURE: {e}")

def process_ogd_record(db: Session, record: dict, crop: str, seen_keys: set = None):
    """
    Upsert logic for a single OGD API record.
    """
    try:
        # Extract fields
        state = record.get("state", "Unknown")
        district = record.get("district", "Unknown")
        market = record.get("market", "Unknown")
        commodity = record.get("commodity", crop)
        variety = record.get("variety", "")
        arrival_date = record.get("arrival_date", datetime.now().strftime("%d/%m/%Y"))
        
        # Normalize commodity naming
        if commodity == "Paddy(Dhan)(Common)":
            commodity = "Rice"

        # Deduplicate
        if seen_keys is not None:
            key = (state, district, market, commodity, arrival_date)
            if key in seen_keys:
                return
            seen_keys.add(key)
        
        try:
            min_price = int(float(record.get("min_price", 0)))
            max_price = int(float(record.get("max_price", 0)))
            modal_price = int(float(record.get("modal_price", 0)))
        except (ValueError, TypeError):
            min_price = max_price = modal_price = 0

        existing = db.query(MandiRate).filter_by(
            state=state, district=district, market=market, commodity=commodity, arrival_date=arrival_date
        ).first()

        if existing:
            existing.min_price = min_price
            existing.max_price = max_price
            existing.modal_price = modal_price
            existing.variety = variety
        else:
            new_rate = MandiRate(
                state=state,
                district=district,
                market=market,
                commodity=commodity,
                variety=variety,
                arrival_date=arrival_date,
                min_price=min_price,
                max_price=max_price,
                modal_price=modal_price
            )
            db.add(new_rate)
            
    except Exception as e:
        print(f"[OGD API] Record Error: {e}")

def get_mandi_data_from_db(db: Session, crop: str, state: str, district: str = None):
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

    # 3. History (Last 7 Days)
    history: List[Dict[str, Any]] = []
    # Take last 7 dates
    history_dates = sorted_dates[-7:]
    
    for d_key in history_dates:
        day_records = data_by_date[d_key]
        day_avg = sum(r.modal_price for r in day_records) / len(day_records)
        d_obj = datetime.strptime(d_key, "%Y-%m-%d")
        
        history.append({
            "date": d_obj.strftime("%d %b"),
            "price": int(day_avg),
            "min": int(min(r.min_price for r in day_records)),
            "max": int(max(r.max_price for r in day_records))
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
