import sys
import os
from dotenv import load_dotenv

sys.path.append(os.path.dirname(__file__) + '/..')

# Load env variables so that database.py uses the correct Supabase URL
load_dotenv()

from app.database import auth_engine
from sqlalchemy import text

with auth_engine.connect() as conn:
    columns_to_add = [
        ('language', 'VARCHAR'),
        ('state', 'VARCHAR'),
        ('district', 'VARCHAR'),
        ('mandal', 'VARCHAR'),
        ('onboarding_completed', 'INTEGER DEFAULT 0'),
        ('crops', 'TEXT'),
        ('alerts_enabled', 'INTEGER DEFAULT 1'),
        ('phone_number', 'VARCHAR'),
        ('sms_alerts_enabled', 'INTEGER DEFAULT 0'),
        ('sms_cooldown_days', 'INTEGER DEFAULT 7'),
        ('last_sms_sent_at', 'TIMESTAMP')
    ]
    for col_name, col_type in columns_to_add:
        try:
            conn.execute(text(f'ALTER TABLE users ADD COLUMN {col_name} {col_type};'))
            conn.commit()
            print(f"Column '{col_name}' added successfully!")
        except Exception as e:
            conn.rollback()
            print(f"Column '{col_name}' check: already exists or skipped")
    print('Schema updates processing complete!')
