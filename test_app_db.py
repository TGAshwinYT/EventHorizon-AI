import os
import sys

# FORCE RENDER to see if it triggers the port switch and causes the error
os.environ["RENDER"] = "true" 

# Add the current directory and 'backend' to sys.path
sys.path.append(os.path.dirname(__file__))
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from dotenv import load_dotenv
load_dotenv(dotenv_path='backend/.env', override=True)

print(f"DEBUG: RENDER env var is: {os.getenv('RENDER')}")

try:
    from app.database import AUTH_DATABASE_URL, auth_engine, auth_engine_args
    print(f"AUTH_DATABASE_URL from app.database: {AUTH_DATABASE_URL}")
    
    from sqlalchemy import text
    with auth_engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        print(f"SUCCESS: Result {result.fetchone()[0]}")
except Exception as e:
    print(f"FAILED: {e}")
