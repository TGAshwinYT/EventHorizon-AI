import os
import sys
from dotenv import load_dotenv
load_dotenv() # Load before importing app modules
from sqlalchemy import text
from app.database import MandiSessionLocal
from app.models import MandiRate
from datetime import datetime

def check_data():
    db = MandiSessionLocal()
    try:
        print("--- Mandi Data Diagnostic ---")
        # Check total count
        count = db.query(MandiRate).count()
        print(f"Total MandiRate records: {count}")
        
        # Check distribution of arrival_date
        date_counts = db.execute(text("SELECT arrival_date, COUNT(*) as count FROM mandi_rates GROUP BY arrival_date ORDER BY arrival_date DESC")).fetchall()
        print("\nArrival Date Distribution:")
        for dc in date_counts:
            print(f"  {dc[0]}: {dc[1]} records")
            
        # Check some samples
        samples = db.query(MandiRate).limit(5).all()
        print("\nSamples:")
        for s in samples:
            print(f"  {s.arrival_date} | {s.commodity} | {s.state} | {s.modal_price}")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_data()
