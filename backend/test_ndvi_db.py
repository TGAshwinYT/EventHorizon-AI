"""
Database verification script for NDVI Readings caching — EventHorizon AI
"""
import sys
import os
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load environmental variables
load_dotenv(override=True)

from sqlalchemy import inspect
from app.database import mandi_engine, MandiSessionLocal
from app.models import NDVIReading

def verify_db():
    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass
    print("=" * 60)
    print("NDVI DATABASE TABLE CACHING VERIFICATION")
    print("=" * 60)
    
    # 1. Inspect table existence
    inspector = inspect(mandi_engine)
    tables = inspector.get_table_names()
    print(f"Registered tables in MANDI database: {tables}")
    
    if "ndvi_readings" in tables:
        print("✅ Success: 'ndvi_readings' table exists in the database.")
    else:
        print("❌ Error: 'ndvi_readings' table was NOT found.")
        return

    # 2. Inspect columns
    print("\nTable Schema / Columns:")
    columns = inspector.get_columns("ndvi_readings")
    for col in columns:
        print(f"  Column: {col['name']} | Type: {col['type']} | Nullable: {col['nullable']}")
        
    # 3. Query existing rows
    session = MandiSessionLocal()
    try:
        count = session.query(NDVIReading).count()
        print(f"\n✅ Total cached NDVI reading rows: {count}")
        
        if count > 0:
            print("\nLatest 5 cached readings:")
            readings = session.query(NDVIReading).order_by(NDVIReading.date.desc()).limit(5).all()
            for r in readings:
                print(f"  ID: {r.id} | Lat: {r.latitude}, Lon: {r.longitude} | Crop: {r.crop_name} | Date: {r.date} | NDVI: {r.ndvi_value}")
    except Exception as e:
        print(f"❌ Error querying 'ndvi_readings': {e}")
    finally:
        session.close()
        
    print("=" * 60)

if __name__ == "__main__":
    verify_db()
