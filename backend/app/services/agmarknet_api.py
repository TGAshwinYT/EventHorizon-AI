import os
import requests
import time
import concurrent.futures
from sqlalchemy import text
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# The specific government API endpoint
AGMARKNET_URL = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"

# Focus on essential commodities for EventHorizon AI
COMMODITIES = [
    'Tomato', 'Onion', 'Potato', 'Rice', 'Wheat', 
    'Maize', 'Cotton', 'Sugarcane', 'Brinjal', 'Cabbage', 
    'Cauliflower', 'Carrot', 'Bhindi(Ladies Finger)', 
    'Green Chilli', 'Apple', 'Banana', 'Mango', 'Orange', 
    'Pomegranate', 'Grapes'
]

def fetch_single_commodity(commodity, target_date, api_key, max_retries=1):
    """
    Fetches data for a single commodity with retry logic and a 30s timeout.
    """
    params = {
        "api-key": api_key,
        "format": "json",
        "filters[commodity]": commodity,
        "filters[arrival_date]": target_date,
        "limit": 1000  # Max limit per request
    }
    
    for attempt in range(max_retries + 1):
        try:
            response = requests.get(AGMARKNET_URL, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()
            records = data.get('records', [])
            
            if records:
                print(f"  > [Success] Fetched {len(records)} raw records for {commodity}.")
            else:
                print(f"  > [Info] No records found for {commodity} today.")
                
            return records
            
        except requests.exceptions.RequestException as e:
            if attempt < max_retries:
                print(f"  > [Retry {attempt + 1}/{max_retries}] Timeout/Error fetching {commodity}: {e}. Retrying...")
                time.sleep(2)  # Short delay before retrying
            else:
                print(f"  > [Failed] Error fetching {commodity} after {max_retries} retries: {e}")
                
    return []

def fetch_agmarknet_mandi_prices(db, target_date=None):
    """
    Fetches daily wholesale prices from Agmarknet for major commodities.
    `target_date` should be in DD/MM/YYYY format if provided.
    Defaults to today's date if not provided.
    """
    
    api_key = os.getenv("AGMARKNET_API_KEY") or os.getenv("API_KEY")
    if not api_key:
        print("[Agmarknet API] No API Key found in environment variables. Skipping fetch.")
        return
        
    if not target_date:
        target_date = datetime.now().strftime("%d/%m/%Y")
        
    print(f"\n[Agmarknet API] Starting daily fetch for Date: {target_date} using ThreadPoolExecutor")
    
    all_records = []
    
    # Use ThreadPoolExecutor for parallel execution (max_workers=10)
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        # Map futures to commodities so we can track requests
        future_to_commodity = {
            executor.submit(fetch_single_commodity, commodity, target_date, api_key): commodity 
            for commodity in COMMODITIES
        }
        
        for future in concurrent.futures.as_completed(future_to_commodity):
            commodity = future_to_commodity[future]
            try:
                records = future.result()
                all_records.extend(records)
            except Exception as exc:
                print(f"  > [Exception] Unexpected error occurred while fetching {commodity}: {exc}")

    if not all_records:
        print("[Agmarknet API] No data fetched across any commodities. Aborting upsert.")
        return

    # Process and clean the data before database insertion
    valid_records = []
    
    for r in all_records:
        try:
            min_p = int(r.get('min_price', 0))
            max_p = int(r.get('max_price', 0))
            mod_p = int(r.get('modal_price', 0))
            
            # Skip invalid entries where modal price is 0
            if mod_p == 0:
                continue
                
            state = r.get('state', 'Unknown').strip()
            district = r.get('district', 'Unknown').strip()
            market = r.get('market', 'Unknown').strip()
            commodity = r.get('commodity', 'Unknown').strip()
            variety = r.get('variety', 'Other').strip()
            arrival_date_raw = r.get('arrival_date', '').strip()
            
            # Ensure safe constraints
            if not arrival_date_raw:
                continue

            # Convert date from DD/MM/YYYY to YYYY-MM-DD for PostgreSQL
            parsed_date = datetime.strptime(arrival_date_raw, "%d/%m/%Y")
            arrival_date = parsed_date.strftime("%Y-%m-%d")

            # Strictly 9 columns, no created_at or updated_at
            valid_records.append({
                "state": state,
                "district": district,
                "market": market,
                "commodity": commodity,
                "variety": variety,
                "arrival_date": arrival_date,
                "min_price": min_p,
                "max_price": max_p,
                "modal_price": mod_p
            })
            
        except ValueError:
            continue

    print(f"\n[Agmarknet API] Finished fetching. Total valid records batched: {len(valid_records)}")

    if not valid_records:
        return

    # Bulk Upsert to Neon Database
    print("[Agmarknet API] Executing bulk upsert...")
    try:
        # We explicitly map ONLY the 9 columns that exist in the database table
        insert_query = text("""
            INSERT INTO mandi_prices (
                state, district, market, commodity, variety, arrival_date, 
                min_price, max_price, modal_price
            ) VALUES (
                :state, :district, :market, :commodity, :variety, :arrival_date, 
                :min_price, :max_price, :modal_price
            )
            ON CONFLICT (state, district, market, commodity, variety, arrival_date) 
            DO UPDATE SET 
                min_price = EXCLUDED.min_price,
                max_price = EXCLUDED.max_price,
                modal_price = EXCLUDED.modal_price
        """)
        
        db.execute(insert_query, valid_records)
        db.commit()
        print("[Agmarknet API] Bulk upsert successful.")
        
    except Exception as e:
        db.rollback()
        print(f"[Agmarknet API] Upsert failed: {e}")
        return

    # Keep database lean: Remove data older than 35 days
    # Exact SQL cleanup query preserved
    print("[Agmarknet API] Executing 35-day rolling cleanup...")
    try:
        cleanup_query = text("""
            DELETE FROM mandi_prices 
            WHERE arrival_date < (CURRENT_DATE - INTERVAL '35 days')
        """)
        db.execute(cleanup_query)
        db.commit()
        print("[Agmarknet API] Cleanup successful. Database optimized.")
    except Exception as e:
        db.rollback()
        print(f"[Agmarknet API] Cleanup failed: {e}")