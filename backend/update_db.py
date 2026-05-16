import sys
import os
from dotenv import load_dotenv

sys.path.append(os.path.dirname(__file__) + '/..')

# Load env variables so that database.py uses the correct Supabase URL
load_dotenv()

from app.database import auth_engine
from sqlalchemy import text

with auth_engine.connect() as conn:
    try:
        conn.execute(text('ALTER TABLE users ADD COLUMN language VARCHAR;'))
        conn.execute(text('ALTER TABLE users ADD COLUMN state VARCHAR;'))
        conn.execute(text('ALTER TABLE users ADD COLUMN district VARCHAR;'))
        conn.execute(text('ALTER TABLE users ADD COLUMN mandal VARCHAR;'))
        conn.execute(text('ALTER TABLE users ADD COLUMN onboarding_completed INTEGER DEFAULT 0;'))
        conn.commit()
        print('Schema updated successfully!')
    except Exception as e:
        print(f"Error: {e}")
