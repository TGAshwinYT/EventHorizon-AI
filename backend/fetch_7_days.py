import os
import sys
from dotenv import load_dotenv
load_dotenv()
sys.path.append(os.getcwd())
from app.database import MandiSessionLocal
from app.models import MandiRate
from app.services.ogd_api import fetch_ogd_mandi_prices

def reset_and_fetch():
    db = MandiSessionLocal()
    try:
        # Truncate all records from MandiRate table (this implicitly means the mock data is gone)
        db.query(MandiRate).delete()
        db.commit()
        print("Mandi tables cleared of all mock and old data.")
        
        # Fetch 7 days array automatically from OGD API
        print("Initiating 7-day historical fetch cycle via OGD API...")
        fetch_ogd_mandi_prices(db)
        print("Data fetched successfully.")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == '__main__':
    reset_and_fetch()
