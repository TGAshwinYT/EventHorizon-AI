import os
import sys
from datetime import datetime
from dotenv import load_dotenv
load_dotenv()

# Add the backend dir to sys.path so we can import app
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

from app.services.ceda_api import fetch_ceda_mandi_prices
from app.database import MandiSessionLocal

def manual_fetch():
    print("--- Targeted Mandi Data Fetch ---")
    
    today_str = datetime.now().strftime("%d/%m/%Y")
    
    db = MandiSessionLocal()
    try:
        print(f"\n>>> Fetching for date: {today_str}")
        fetch_ceda_mandi_prices(db=db, target_date=today_str)
            
        print("\nFetch attempt completed.")
    except Exception as e:
        print(f"Error during manual fetch: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    manual_fetch()
