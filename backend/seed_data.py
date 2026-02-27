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
        
        commodities = [
            'Tomato', 'Onion', 'Potato', 'Rice', 'Wheat', 
            'Maize', 'Cotton', 'Sugarcane', 'Brinjal', 'Cabbage', 
            'Cauliflower', 'Carrot', 'Bhindi(Ladies Finger)', 
            'Green Chilli', 'Apple', 'Banana', 'Mango', 'Orange', 
            'Pomegranate', 'Grapes'
        ]
        
        # A subset of major agricultural states and specific districts to seed
        locations = [
            {"state": "Tamil Nadu", "districts": ["Coimbatore", "Erode", "Madurai", "Salem"]},
            {"state": "Maharashtra", "districts": ["Pune", "Nashik", "Nagpur", "Ahmednagar"]},
            {"state": "Karnataka", "districts": ["Bengaluru", "Mysuru", "Belagavi", "Hubballi"]},
            {"state": "Punjab", "districts": ["Amritsar", "Ludhiana", "Patiala", "Jalandhar"]},
            {"state": "Uttar Pradesh", "districts": ["Agra", "Kanpur", "Lucknow", "Varanasi"]},
            {"state": "Gujarat", "districts": ["Ahmedabad", "Surat", "Rajkot", "Vadodara"]},
            {"state": "Madhya Pradesh", "districts": ["Indore", "Bhopal", "Ujjain", "Gwalior"]},
            {"state": "Andhra Pradesh", "districts": ["Guntur", "Krishna", "Kurnool", "Srikakulam"]}
        ]
        
        today = datetime.utcnow()
        records_added = 0
        
        # We will use SQLAlchemy ORM's bulk_save_objects for speed since this is a lot of data
        # To avoid unique constraint errors during bulk insert, we'll first clear the entire table
        # Since this is a synthetic seed command requested by the user.
        print("Clearing existing table for clean synthetic bulk seed...")
        db.query(MandiRate).delete()
        db.commit()
        
        batch = []
        batch_size = 5000
        
        print("Starting massive synthetic data generation. This will take a moment...")
        
        for loc in locations:
            state = loc["state"]
            for district in loc["districts"]:
                market = f"{district} Mandi"
                for commodity in commodities:
                    # Base price changes based on commodity
                    base_price = random.randint(800, 3500) 
                    
                    for i in range(30):
                        target_date = today - timedelta(days=(29 - i))
                        arrival_date_str = target_date.strftime("%d/%m/%Y")
                        
                        # Fluctuate day by day
                        modal_price = base_price + random.randint(-150, 150)
                        
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
                            updated_at=target_date 
                        )
                        batch.append(new_rate)
                        records_added += 1
                        
                        if len(batch) >= batch_size:
                            db.bulk_save_objects(batch)
                            db.commit()
                            batch = []
                            print(f"Committed {records_added} records...")
                            
        # Commit any remaining records
        if batch:
            db.bulk_save_objects(batch)
            db.commit()
            
        print(f"\nSuccessfully generated and seeded {records_added} rows of synthetic data natively across {len(locations)} states and {len(commodities)} commodities!")
        
    except Exception as e:
        print(f"An error occurred: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
