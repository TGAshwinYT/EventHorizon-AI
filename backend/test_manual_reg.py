from sqlalchemy import create_engine
from sqlalchemy.dialects import registry
import os
from dotenv import load_dotenv

load_dotenv(override=True)

# Explicitly register the dialect
print("Registering dialect manually...")
registry.register("postgresql.pg8000", "sqlalchemy.dialects.postgresql.pg8000", "PGDialect_pg8000")

url = os.getenv("DATABASE_URL")
print(f"Testing URL: {url}")

try:
    engine = create_engine(url)
    with engine.connect() as conn:
        print("Connected successfully with manual registration!")
except Exception as e:
    print(f"Failed even with manual registration: {e}")
