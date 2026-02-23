import os
import sys
from sqlalchemy import create_engine, text

# Using the DIRECT hostname
# Host: omkjkxjqyajebafbrcoc.supabase.co
# User: postgres
url = "postgresql+psycopg2://postgres:ruthramoorthy05@omkjkxjqyajebafbrcoc.supabase.co:5432/postgres?sslmode=require"

print(f"Testing DIRECT URL: {url}")

try:
    engine = create_engine(url)
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        print(f"SUCCESS: Result {result.fetchone()[0]}")
except Exception as e:
    print(f"FAILED: {e}")
