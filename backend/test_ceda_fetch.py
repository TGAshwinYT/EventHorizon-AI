import sys
import os

# Ensure backend acts as module root
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.ceda_api import fetch_ceda_mandi_prices
from app.database import MandiSessionLocal
from app.models import MandiRate

def test_fetch():
    print("Testing CEDA API Fetch for today...")
    db = MandiSessionLocal()
    try:
        # Fetch just one day to test
        fetch_ceda_mandi_prices(db, target_date="01/03/2024")
        
        # Check if we got data
        count = db.query(MandiRate).count()
        print(f"Total Mandi Rates in DB: {count}")
        
        latest = db.query(MandiRate).order_by(MandiRate.id.desc()).limit(5).all()
        print("Last 5 records inserted/updated:")
        for r in latest:
             print(f"- {r.commodity} in {r.state} ({r.district}): Min: {r.min_price}, Max: {r.max_price}, Modal: {r.modal_price}, Date: {r.arrival_date}")

    finally:
        db.close()

if __name__ == "__main__":
    test_fetch()
