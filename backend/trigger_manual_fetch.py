import os
import sys
from dotenv import load_dotenv
load_dotenv()

# Add the backend dir to sys.path so we can import app
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

from app.services.ceda_api import fetch_ceda_mandi_prices
from app.database import MandiSessionLocal

def manual_fetch():
    print("--- Targeted Mandi Data Fetch ---")
    
    # Try Today
    dates = ["27/02/2026"]
    crops = ["Tomato", "Onion", "Potato", "Rice", "Wheat"]
    
    db = MandiSessionLocal()
    try:
        for target_date in dates:
            print(f"\n>>> Fetching for date: {target_date}")
            # We bypass the default commodities list in ogd_api by passing our own if we can,
            # but fetch_ogd_mandi_prices uses its internal list.
            # I will modify ogd_api.py temporarily to use a smaller list if needed, 
            # or just call the internal helper if it exists.
            
            # Since fetch_ceda_mandi_prices works similarly
            fetch_ceda_mandi_prices(db=db, target_date=target_date)
            
        print("\nAll fetch attempts completed.")
    except Exception as e:
        print(f"Error during manual fetch: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    manual_fetch()
