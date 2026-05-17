import sys
import os
from dotenv import load_dotenv

# Ensure backend directory is in the system path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Load environmental configurations
load_dotenv()

from app.services.agmarknet_api import fetch_agmarknet_mandi_prices
from app.database import MandiSessionLocal

if __name__ == "__main__":
    print("[Mandi CLI Fetcher] Triggering manual daily Mandi price fetch...")
    
    db = MandiSessionLocal()
    try:
        # Check for target_date from CLI argument
        target_date = sys.argv[1] if len(sys.argv) > 1 else None
        if target_date:
            print(f"[Mandi CLI Fetcher] Querying target date: {target_date}")
        # Executes the parallelized, retrying, browser-authenticated agmarknet API fetcher
        fetch_agmarknet_mandi_prices(db=db, target_date=target_date)
        print("[Mandi CLI Fetcher] Fetch and rolling cleanup completed successfully.")
    except Exception as e:
        print(f"[Mandi CLI Fetcher] CRITICAL: Execution failed: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()
