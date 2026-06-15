"""
Database verification script for Mandi Prices query optimizations — EventHorizon AI
"""
import sys
import os
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load environmental variables
load_dotenv(override=True)

from sqlalchemy import inspect, text
from app.database import mandi_engine, MandiSessionLocal
from app.models import MandiRate

def verify_db_queries():
    # Ensure stdout supports UTF-8 to print emojis on Windows
    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass

    print("=" * 60)
    print("MANDI DATABASE OPTIMIZATION & INDEX VERIFICATION")
    print("=" * 60)
    
    # 1. Inspect table existence
    inspector = inspect(mandi_engine)
    tables = inspector.get_table_names()
    print(f"Registered tables in database: {tables}")
    
    if "mandi_prices" in tables:
        print("✅ Success: 'mandi_prices' table exists in the database.")
    else:
        print("❌ Error: 'mandi_prices' table was NOT found.")
        return

    # 2. Inspect registered columns and check index status
    print("\nTable Schema / Columns:")
    columns = inspector.get_columns("mandi_prices")
    for col in columns:
        print(f"  Column: {col['name']} | Type: {col['type']} | Nullable: {col['nullable']}")

    # 3. Inspect indexes and unique constraints
    print("\nTable Indexes:")
    indexes = inspector.get_indexes("mandi_prices")
    for idx in indexes:
        print(f"  Index Name: {idx['name']} | Columns: {idx['column_names']} | Unique: {idx['unique']}")

    print("\nUnique Constraints:")
    constraints = inspector.get_unique_constraints("mandi_prices")
    for c in constraints:
        print(f"  Constraint Name: {c['name']} | Columns: {c['column_names']}")

    # 4. Verify optimized UNION ALL queries
    print("\nExecuting test queries...")
    session = MandiSessionLocal()
    try:
        # Check table row count
        count = session.query(MandiRate).count()
        print(f"Total rows in 'mandi_prices': {count}")

        # Recent rates query
        recent_query = text("""
            SELECT arrival_date, AVG(min_price) as min_price, AVG(max_price) as max_price, AVG(modal_price) as modal_price
            FROM (
                SELECT arrival_date, min_price, max_price, modal_price FROM mandi_prices WHERE commodity = :commodity AND state = :market
                UNION ALL
                SELECT arrival_date, min_price, max_price, modal_price FROM mandi_prices WHERE commodity = :commodity AND district = :market
                UNION ALL
                SELECT arrival_date, min_price, max_price, modal_price FROM mandi_prices WHERE commodity = :commodity AND market = :market
            ) as combined
            GROUP BY arrival_date
            ORDER BY arrival_date DESC
            LIMIT 5;
        """)

        recent_res = session.execute(recent_query, {"commodity": "Rice", "market": "Tamil Nadu"}).fetchall()
        print(f"✅ Recent query executed successfully. Returned {len(recent_res)} records.")

        # Forecast query
        forecast_query = text("""
            SELECT arrival_date, AVG(modal_price) as modal_price 
            FROM (
                SELECT arrival_date, modal_price FROM mandi_prices WHERE commodity = :commodity AND state = :market AND modal_price IS NOT NULL
                UNION ALL
                SELECT arrival_date, modal_price FROM mandi_prices WHERE commodity = :commodity AND district = :market AND modal_price IS NOT NULL
                UNION ALL
                SELECT arrival_date, modal_price FROM mandi_prices WHERE commodity = :commodity AND market = :market AND modal_price IS NOT NULL
            ) as combined
            GROUP BY arrival_date
            ORDER BY arrival_date DESC
            LIMIT 30;
        """)

        forecast_res = session.execute(forecast_query, {"commodity": "Rice", "market": "Tamil Nadu"}).fetchall()
        print(f"✅ Forecast query executed successfully. Returned {len(forecast_res)} records.")

    except Exception as e:
        print(f"❌ Query execution failed: {e}")
    finally:
        session.close()
        
    print("=" * 60)

if __name__ == "__main__":
    verify_db_queries()
