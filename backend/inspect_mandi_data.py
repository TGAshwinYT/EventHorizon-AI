import os
import sys
from dotenv import load_dotenv
from sqlalchemy import text

# Add the backend dir to sys.path so we can import app
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

from app.database import MandiSessionLocal

def inspect_db():
    load_dotenv()
    db = MandiSessionLocal()
    try:
        query = text("SELECT arrival_date, commodity, market FROM mandi_rates LIMIT 5")
        results = db.execute(query).fetchall()
        print("SAMPLE_DATA:")
        for r in results:
            print(f" - Date: '{r[0]}', Commodity: '{r[1]}', Market: '{r[2]}'")
    finally:
        db.close()

if __name__ == "__main__":
    inspect_db()
