"""
Local SQLite validation script for NDVI Readings caching — EventHorizon AI
"""
import sys
import os
from datetime import datetime

# Setup absolute paths
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker
from app.models import NDVIReading, MandiBase

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_mandi.db")
SQLITE_URL = f"sqlite:///{DB_PATH}"

def verify_db_local():
    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass
    print("=" * 60)
    print("NDVI LOCAL SQLITE DB MODEL VERIFICATION")
    print("=" * 60)

    # 1. Initialize Engine
    print(f"Creating local test SQLite engine: {SQLITE_URL}")
    engine = create_engine(SQLITE_URL)
    
    # 2. Create Tables
    print("Creating all tables in MandiBase metadata...")
    MandiBase.metadata.create_all(bind=engine)
    
    # 3. Inspect Schema
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    print(f"Created tables in SQLite: {tables}")
    
    if "ndvi_readings" in tables:
        print("✅ Success: 'ndvi_readings' table exists.")
    else:
        print("❌ Error: 'ndvi_readings' table was NOT created.")
        return

    # Check Columns
    print("\nTable Columns Info:")
    columns = inspector.get_columns("ndvi_readings")
    for col in columns:
        print(f"  - Name: {col['name']} | Type: {col['type']} | Nullable: {col['nullable']}")

    # 4. Insert Mock Entry
    print("\nAttempting to insert a mock NDVI reading...")
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = SessionLocal()
    
    try:
        new_reading = NDVIReading(
            latitude=12.9716,
            longitude=77.5946,
            state="Karnataka",
            district="Bengaluru",
            crop_name="Rice",
            date=datetime.strptime("2026-06-14", "%Y-%m-%d").date(),
            ndvi_value=0.58
        )
        session.add(new_reading)
        session.commit()
        print("✅ Success: Mock reading committed successfully.")
        
        # Test unique constraint: insert duplicate
        print("\nAttempting to insert a duplicate reading (should fail unique constraint)...")
        duplicate_reading = NDVIReading(
            latitude=12.9716,
            longitude=77.5946,
            state="Karnataka",
            district="Bengaluru",
            crop_name="Rice",
            date=datetime.strptime("2026-06-14", "%Y-%m-%d").date(),
            ndvi_value=0.62 # Different value but same unique keys
        )
        session.add(duplicate_reading)
        try:
            session.commit()
            print("❌ Failure: Duplicate row committed (unique constraint failed to trigger).")
        except Exception as e:
            session.rollback()
            print(f"✅ Success: Duplicate insert rejected as expected. Error: {type(e).__name__}")
            
        # 5. Query and Display
        print("\nQuerying saved NDVI readings:")
        saved = session.query(NDVIReading).all()
        for r in saved:
            print(f"  ID: {r.id} | Coordinate: ({r.latitude}, {r.longitude}) | Crop: {r.crop_name} | Date: {r.date} | NDVI: {r.ndvi_value}")
            
    except Exception as e:
        print(f"❌ Error during CRUD operations: {e}")
    finally:
        session.close()

    # 6. Teardown
    print("\nCleaning up local test database...")
    try:
        # Release process locks on SQLite file before deletion
        engine.dispose()
        if os.path.exists(DB_PATH):
            os.remove(DB_PATH)
            print("✅ Cleaned up test_mandi.db file.")
    except Exception as e:
        print(f"Warning: Failed to clean up {DB_PATH}: {e}")

    print("=" * 60)

if __name__ == "__main__":
    verify_db_local()
