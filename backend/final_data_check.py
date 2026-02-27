import os
import sys
from dotenv import load_dotenv
from sqlalchemy import text

# Add the backend dir to sys.path so we can import app
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

from app.database import MandiSessionLocal

def final_check():
    load_dotenv()
    db = MandiSessionLocal()
    try:
        # Check Today and a known past date
        for date_str in ["26/02/2026", "23/02/2026"]:
            query = text(f"SELECT count(*) FROM mandi_rates WHERE arrival_date = '{date_str}'")
            result = db.execute(query).scalar()
            print(f"COUNT_FOR_{date_str}: {result}")
    finally:
        db.close()

if __name__ == "__main__":
    final_check()
