import os
import sys
from dotenv import load_dotenv

# Ensure we're in the right directory to load .env
os.chdir(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(override=True)

# Add current dir to path to import app
sys.path.append(os.getcwd())

def verify_connections():
    print("--- VERIFYING DATABASE CONNECTIONS ---")
    try:
        from app.database import AuthSessionLocal, MandiSessionLocal, auth_engine, mandi_engine
        from sqlalchemy import text
        
        print(f"Auth Engine: {auth_engine.url}")
        print(f"Mandi Engine: {mandi_engine.url}")
        
        print("\nTesting Auth DB connection...")
        with auth_engine.connect() as conn:
            result = conn.execute(text("SELECT 1")).fetchone()
            print(f"Auth DB Success: {result}")
            
        print("\nTesting Mandi DB connection...")
        with mandi_engine.connect() as conn:
            result = conn.execute(text("SELECT 1")).fetchone()
            print(f"Mandi DB Success: {result}")
            
        print("\n--- ALL CONNECTIONS VERIFIED ---")
        return True
    except Exception as e:
        print(f"\nCRITICAL CONNECTION FAILURE: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = verify_connections()
    sys.exit(0 if success else 1)
