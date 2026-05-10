from app.database import MandiSessionLocal, debug_print
from app.services.agmarknet_api import fetch_agmarknet_mandi_prices

def fetch_and_maintain_mandi_prices():
    """
    Background Task: Delegates to the robust agmarknet_api fetcher.
    Fetches live data, upserts into mandi_prices, and enforces a 35-day sliding window.
    """
    debug_print("[Mandi background Task] Triggering robust agmarknet fetcher...")
    
    db = MandiSessionLocal()
    try:
        # Call the robust fetcher which handles parallelization, retries, and cleanup
        fetch_agmarknet_mandi_prices(db=db)
        debug_print("[Mandi background Task] Task completed successfully.")
    except Exception as e:
        debug_print(f"[Mandi background Task] Error during task: {e}")
    finally:
        db.close()

