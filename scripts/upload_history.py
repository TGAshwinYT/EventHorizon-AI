import os
import sys
import pandas as pd
from datetime import datetime
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

# Add the backend directory to sys.path so we can import app
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

try:
    from app.database import MandiSessionLocal
    from app.models import MandiRate
except ImportError as e:
    print(f"Error: Could not import app modules. Make sure the backend directory is in the right place. {e}")
    sys.exit(1)

def upload_historical_data(csv_path: str):
    """
    Reads a Mandi price CSV and performs a bulk upsert into the Neon database.
    Format expected: State, District, Market, Commodity, Variety, Arrival_Date, Min Price, Max Price, Modal Price
    """
    if not os.path.exists(csv_path):
        print(f"Error: File not found at {csv_path}")
        return

    print(f"Reading CSV: {csv_path}")
    try:
        df = pd.read_csv(csv_path)
    except Exception as e:
        print(f"Error reading CSV: {e}")
        return

    # Standardize column names (handle potential spaces or case issues)
    df.columns = [c.strip().replace(" ", "_").lower() for c in df.columns]
    
    # Mapping CSV columns to DB columns
    column_mapping = {
        "state": "state",
        "district": "district",
        "market": "market",
        "commodity": "commodity",
        "variety": "variety",
        "arrival_date": "arrival_date",
        "min_price": "min_price",
        "max_price": "max_price",
        "modal_price": "modal_price"
    }

    # Rename if necessary
    df = df.rename(columns=column_mapping)
    
    # Filter for required columns
    required_cols = list(column_mapping.values())
    df = df[required_cols]

    # Clean data: drop rows with missing modal_price or critical fields
    df = df.dropna(subset=['state', 'market', 'commodity', 'arrival_date', 'modal_price'])
    
    # Convert prices to integers
    for col in ['min_price', 'max_price', 'modal_price']:
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0).astype(int)

    # Convert dataframe to list of dicts for bulk insert
    records = df.to_dict('records')
    print(f"Prepared {len(records)} records for upload.")

    if not records:
        print("No valid records found after cleaning. Exiting.")
        return

    db = MandiSessionLocal()
    try:
        print("Executing bulk upsert with conflict handling...")
        # Chunking to avoid massive single transactions
        chunk_size = 1000
        for i in range(0, len(records), chunk_size):
            chunk = records[i:i + chunk_size]
            stmt = insert(MandiRate).values(chunk)
            
            # Upsert logic
            upsert_stmt = stmt.on_conflict_do_update(
                # Trying uix_mandi_rate as seen in models.py
                constraint="uix_mandi_rate",
                set_={
                    "min_price": stmt.excluded.min_price,
                    "max_price": stmt.excluded.max_price,
                    "modal_price": stmt.excluded.modal_price,
                    "variety": stmt.excluded.variety,
                    "updated_at": datetime.utcnow()
                },
                where=(stmt.excluded.modal_price > 0) # Only update if new record has valid price
            )
            db.execute(upsert_stmt)
            print(f"  > Uploaded chunk {i // chunk_size + 1} ({len(chunk)} rows)")
        
        db.commit()
        print(f"Successfully uploaded {len(records)} historical records.")
    except Exception as e:
        db.rollback()
        print(f"CRITICAL ERROR during DB upload: {e}")
        print("Note: If 'uix_mandi_rate' failed, you might need to check the constraint name in the DB.")
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python upload_history.py <path_to_csv>")
    else:
        upload_historical_data(sys.argv[1])
