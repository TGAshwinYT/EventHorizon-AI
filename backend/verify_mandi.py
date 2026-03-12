import os
import sys
from datetime import datetime, timedelta
from sqlalchemy import text, func
from sqlalchemy.orm import Session
from typing import Optional

# Add the backend dir to sys.path so we can import app
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import MandiSessionLocal, mandi_engine
from app.models import MandiRate

def verify_pipeline():
    print("--- Mandatory Phase 1: DB Constraint & UPSERT Verification ---")
    db = MandiSessionLocal()
    try:
        # 1. Clean up potential old test data
        db.execute(text("DELETE FROM mandi_rates WHERE state = 'VerificationTest';"))
        db.commit()

        # 2. Insert initial record
        test_record = {
            "state": "VerificationTest",
            "district": "TestDistrict",
            "market": "TestMarket",
            "commodity": "TestCrop",
            "variety": "Refined",
            "arrival_date": "26/02/2026",
            "min_price": 1000,
            "max_price": 2000,
            "modal_price": 1500
        }
        
        from app.services.agmarknet_api import fetch_agmarknet_mandi_prices
        print("Inserting initial record...")
        process_ceda_record(db, test_record, "TestCrop", None)
        db.commit()

        # 3. Attempt to insert duplicate (same date) with DIFFERENT prices
        # Native UPSERT should update instead of duplicating
        update_record = test_record.copy()
        update_record["modal_price"] = 1600
        print("Inserting duplicate record (UPSERT branch)...")
        process_ceda_record(db, update_record, "TestCrop", None)
        db.commit()

        # 4. Check results - Should only have 1 record with modal_price 1600
        res = db.query(MandiRate).filter(MandiRate.state == "VerificationTest").all()
        print(f"Number of records: {len(res)}")
        if len(res) == 1 and res[0].modal_price == 1600:
            print("[\u2705] SUCCESS: UPSERT logic and DB constraint working.")
        else:
            print(f"[\u274c] FAILURE: Expected 1 record with 1600, got {len(res)} records.")

        print("\n--- Mandatory Phase 2: Rolling Window Verification ---")
        # 5. Insert old data (older than 5 days)
        old_date = (datetime.now() - timedelta(days=6)).strftime("%d/%m/%Y")
        old_record = test_record.copy()
        old_record["arrival_date"] = old_date
        old_record["market"] = "OldMarket"
        print(f"Inserting old record ({old_date})...")
        process_ceda_record(db, old_record, "TestCrop", None)
        db.commit()

        # 6. Run cleanup
        print("Running 5-day rolling window cleanup...")
        cleanup_query = text("""
            DELETE FROM mandi_rates 
            WHERE to_date(arrival_date, 'DD/MM/YYYY') < (CURRENT_DATE - INTERVAL '5 days')
        """)
        db.execute(cleanup_query)
        db.commit()

        # 7. Verify cleanup
        res_old = db.query(MandiRate).filter(MandiRate.market == "OldMarket").first()
        if not res_old:
            print("[\u2705] SUCCESS: 5-day rolling window cleanup working.")
        else:
            print("[\u274c] FAILURE: Old record still exists after cleanup.")

        print("\n--- Mandatory Phase 3: Chronological Sorting Verification ---")
        # 8. Create 3 days of data
        dates = ["24/02/2026", "25/02/2026", "23/02/2026"] # Out of order
        for d in dates:
            rec = test_record.copy()
            rec["arrival_date"] = d
            rec["market"] = f"Market_{d.replace('/', '')}"
            process_ceda_record(db, rec, "TestCrop", None)
        db.commit()

        # 9. Verify sorting logic (mocking market.py logic)
        query = db.query(MandiRate).filter(MandiRate.state == 'VerificationTest')
        records = query.order_by(func.to_date(MandiRate.arrival_date, 'DD/MM/YYYY').asc()).all()
        sorted_dates = [r.arrival_date for r in records]
        print(f"Sorted dates: {sorted_dates}")
        if sorted_dates == sorted(sorted_dates, key=lambda x: datetime.strptime(x, "%d/%m/%Y")):
            print("[\u2705] SUCCESS: Chronological sorting (oldest to newest) working.")
        else:
            print("[\u274c] FAILURE: Sorting is incorrect.")
        
        print("\n--- Mandatory Phase 4: Price Zeroing Protection Verification ---")
        # 10. Insert a valid starting record
        base_record = test_record.copy()
        base_record["market"] = "ZeroTestMarket"
        base_record["modal_price"] = 2500
        process_ceda_record(db, base_record, "TestCrop", None)
        db.commit()

        # 11. Attempt to "update" with invalid data (ValueError/TypeError)
        invalid_record = base_record.copy()
        invalid_record["modal_price"] = "not_a_number"
        print("Attempting to update with invalid price string...")
        process_ceda_record(db, invalid_record, "TestCrop", None)
        db.commit()
        
        check1 = db.query(MandiRate).filter(MandiRate.market == "ZeroTestMarket").first()
        if check1 and check1.modal_price == 2500:
            print("[\u2705] SUCCESS: Invalid string data was skipped.")
        else:
            print(f"[\u274c] FAILURE: Valid data was lost or changed: {check1.modal_price if check1 else 'None'}")

        # 12. Attempt to "update" with zero/negative price
        zero_record = base_record.copy()
        zero_record["modal_price"] = 0
        print("Attempting to update with zero price...")
        process_ceda_record(db, zero_record, "TestCrop", None)
        db.commit()

        check2 = db.query(MandiRate).filter(MandiRate.market == "ZeroTestMarket").first()
        if check2 and check2.modal_price == 2500:
            print("[\u2705] SUCCESS: Zero price update was skipped.")
        else:
            print(f"[\u274c] FAILURE: Valid data was overwritten by zero: {check2.modal_price if check2 else 'None'}")

        # 13. Verify valid update still works
        valid_update = base_record.copy()
        valid_update["modal_price"] = 2600
        print("Attempting valid update (2600)...")
        process_ceda_record(db, valid_update, "TestCrop", None)
        db.commit()

        check3 = db.query(MandiRate).filter(MandiRate.market == "ZeroTestMarket").first()
        if check3 and check3.modal_price == 2600:
            print("[\u2705] SUCCESS: Valid updates still work.")
        else:
            print(f"[\u274c] FAILURE: Valid update failed: {check3.modal_price if check3 else 'None'}")

        # Cleanup
        db.execute(text("DELETE FROM mandi_rates WHERE state = 'VerificationTest';"))
        db.commit()

    finally:
        db.close()

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    verify_pipeline()
