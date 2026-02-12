import os
from dotenv import load_dotenv
from sqlalchemy import create_engine

# Load .env, overriding existing env vars
load_dotenv(override=True)

url = os.getenv("DATABASE_URL")
print(f"DEBUG: URL is '{url}'")

try:
    engine = create_engine(url)
    with engine.connect() as conn:
        print("Successfully connected!")
except Exception as e:
    print(f"Error connecting: {e}")
