import os
import sys
from sqlalchemy import create_engine, text

# Simulating the alternate URL format
url = "postgresql+psycopg2://postgres:ruthramoorthy05@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?options=project%3Domkjkxjqyajebafbrcoc&sslmode=require"

print(f"Testing ALTERNATE URL: {url}")

try:
    engine = create_engine(url)
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        print(f"SUCCESS: Result {result.fetchone()[0]}")
except Exception as e:
    print(f"FAILED: {e}")
