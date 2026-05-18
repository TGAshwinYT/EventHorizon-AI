from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from app.services.ceda_api import fetch_ceda_mandi_prices
from app.database import MandiSessionLocal, AuthSessionLocal, debug_print
from datetime import datetime, timedelta

# Initialize AsyncIOScheduler
scheduler = AsyncIOScheduler()

async def scheduled_mandi_task():
    """
    Wrapper function to safely run Mandi data fetch in the background.
    Opens and closes a MandiSessionLocal session correctly.
    """
    debug_print("[Scheduler] Starting scheduled Mandi data fetch...")
    db = MandiSessionLocal()
    try:
        # Run the sync fetcher
        fetch_ceda_mandi_prices(db=db)
        debug_print("[Scheduler] Mandi data fetch completed successfully.")
    except Exception as e:
        debug_print(f"[Scheduler] Mandi data fetch failed: {e}")
    finally:
        db.close()

def start_scheduler():
    """
    Starts the AsyncIOScheduler and schedules the cron jobs.
    """
    if not scheduler.running:
        # Schedule Mandi Data Fetch daily at 02:00 AM
        scheduler.add_job(
            scheduled_mandi_task, 
            CronTrigger(hour=2, minute=0), 
            id='mandi_daily_fetch', 
            replace_existing=True
        )
        
        scheduler.start()
        debug_print("Async Background Scheduler started (Mandi Fetch @ 02:00 AM).")

def shutdown_scheduler():
    """
    Shuts down the scheduler cleanly.
    """
    if scheduler.running:
        scheduler.shutdown()
        debug_print("Async Background Scheduler shut down.")
