import os
import random
from datetime import datetime, timedelta
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Load environment variables from .env
load_dotenv()

from app.database import MandiSessionLocal, mandi_engine

# Setup path so the script can import from app
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import the model
from app.models import MandiRate
from app.database import MandiBase

def seed_database():
    print("Connecting to database...")
    db = MandiSessionLocal()
    try:
        MandiBase.metadata.create_all(bind=mandi_engine)
        
        commodity = "Tomato"
        state = "Tamil Nadu"
        district = "Coimbatore"
        market = "Coimbatore Mandi"
        
        print(f"Generating 30 days of data for {commodity} in {market}, {state}...")
        
        # Generate exactly 30 dates ending on today
        today = datetime.utcnow()
        records_added = 0
        
        for i in range(30):
            # i=0 is 29 days ago, i=29 is today
            target_date = today - timedelta(days=(29 - i))
            arrival_date_str = target_date.strftime("%d/%m/%Y")
            
            # Generate fluctuating realistic prices between 900 and 1200
            modal_price = random.randint(900, 1200)
            
            # Use query to avoid unique constraint violations on re-run
            existing_record = db.query(MandiRate).filter(
                MandiRate.state == state,
                MandiRate.district == district,
                MandiRate.market == market,
                MandiRate.commodity == commodity,
                MandiRate.arrival_date == arrival_date_str
            ).first()
            
            if existing_record:
                existing_record.modal_price = modal_price
                # Spoof the updated_at so the 30-day API query picks it up temporally
                existing_record.updated_at = target_date 
            else:
                new_rate = MandiRate(
                    state=state,
                    district=district,
                    market=market,
                    commodity=commodity,
                    variety="Local",
                    arrival_date=arrival_date_str,
                    min_price=modal_price - 50,
                    max_price=modal_price + 50,
                    modal_price=modal_price,
                    created_at=target_date, 
                    updated_at=target_date # Crucial for the Prophet filtering query
                )
                db.add(new_rate)
            records_added += 1
            
        db.commit()
        print(f"Successfully seeded {records_added} rows!")
        
    except Exception as e:
        print(f"An error occurred: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
