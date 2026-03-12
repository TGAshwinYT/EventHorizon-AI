import os
import requests
from datetime import datetime
from sqlalchemy import text
from app.database import MandiSessionLocal, debug_print

AGMARKNET_API_KEY = os.getenv("AGMARKNET_API_KEY") 
BASE_URL = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"

COMMODITIES = ['Tomato', 'Onion', 'Potato', 'Rice', 'Wheat', 'Maize', 'Cotton']

def fetch_and_maintain_mandi_prices():
    """
    Background Task: Fetches live data, upserts into mandi_prices, and enforces a 35-day sliding window.
    """
    debug_print("[Mandi background Task] Starting daily mandi data fetch...")
    if not AGMARKNET_API_KEY:
        debug_print("[Mandi background Task] AGMARKNET_API_KEY not found. Skipping...")
        return
        
    db = MandiSessionLocal()
    try:
        import urllib3
        import urllib.parse
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        
        today_str = datetime.now().strftime("%d/%m/%Y")
        records_to_insert = []
        
        for crop in COMMODITIES:
            # Note: Paddy(Dhan)(Common) usually needs special mapping for Rice in Agmarknet
            fetch_crop = "Paddy(Dhan)(Common)" if crop == "Rice" else crop
            encoded_crop = urllib.parse.quote(fetch_crop)
            encoded_date = urllib.parse.quote(today_str)
            
            # 1. Fetch Today's Data
            api_url = f"{BASE_URL}?api-key={AGMARKNET_API_KEY}&format=json&limit=500&filters[commodity]={encoded_crop}&filters[arrival_date]={encoded_date}"
            
            response = requests.get(api_url, timeout=30, verify=False)
            if response.status_code == 200:
                data = response.json()
                for rec in data.get("records", []):
                    try:
                        modal_price = float(rec.get("modal_price"))
                        if modal_price <= 0: continue
                        
                        records_to_insert.append({
                            "state": rec.get("state", "").title(),
                            "district": rec.get("district", "").title(),
                            "market": rec.get("market", "").title(),
                            "commodity": crop,  # Store as the mapped generic crop name
                            "variety": rec.get("variety", ""),
                            "arrival_date": datetime.strptime(rec.get("arrival_date"), "%d/%m/%Y").date(),
                            "min_price": float(rec.get("min_price", 0) or 0),
                            "max_price": float(rec.get("max_price", 0) or 0),
                            "modal_price": modal_price
                        })
                    except (ValueError, TypeError):
                        pass
        
        if not records_to_insert:
            debug_print("[Mandi background Task] No new data found for today.")
            return

        # 2. Insert Today's Data (Upsert using ON CONFLICT DO NOTHING)
        insert_query = text("""
            INSERT INTO mandi_prices (state, district, market, commodity, variety, arrival_date, min_price, max_price, modal_price)
            VALUES (:state, :district, :market, :commodity, :variety, :arrival_date, :min_price, :max_price, :modal_price)
            ON CONFLICT (state, district, market, commodity, variety, arrival_date) 
            DO NOTHING;
        """)
        
        # Execute many
        for rec in records_to_insert:
            db.execute(insert_query, rec)
        
        db.commit()
        debug_print(f"[Mandi background Task] Successfully inserted {len(records_to_insert)} records.")
        
        # 3. The Sliding Window (Delete strictly older than 35 days)
        # We use CURRENT_DATE in PostgreSQL
        delete_query = text("""
            DELETE FROM mandi_prices 
            WHERE arrival_date < CURRENT_DATE - INTERVAL '35 days';
        """)
        result = db.execute(delete_query)
        db.commit()
        
        debug_print(f"[Mandi background Task] Sliding Window Cleanup complete. Dropped {result.rowcount} stale records.")

    except Exception as e:
        db.rollback()
        debug_print(f"[Mandi background Task] Error during task: {e}")
    finally:
        db.close()
