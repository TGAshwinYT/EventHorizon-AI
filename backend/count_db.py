import os
import sys
from sqlalchemy import text
sys.path.insert(0, os.getcwd())
from app.database import MandiSessionLocal
db = MandiSessionLocal()
for d in ['27/02/2026', '26/02/2026', '25/02/2026', '24/02/2026', '23/02/2026']:
    print(f"{d}:", db.execute(text(f"SELECT count(*) FROM mandi_rates WHERE arrival_date = '{d}'")).scalar())
db.close()
