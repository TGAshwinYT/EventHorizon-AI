from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from app.services.mandi_background_task import fetch_and_maintain_mandi_prices
from app.database import MandiSessionLocal, AuthSessionLocal, debug_print
from app.models import ChatHistory
from datetime import datetime, timedelta

# Initialize AsyncIOScheduler
scheduler = AsyncIOScheduler()

async def scheduled_mandi_task():
    """
    Wrapper function to safely run Mandi data fetch in the background.
    Opens and closes a MandiSessionLocal session correctly.
    """
    debug_print("[Scheduler] Starting scheduled Mandi data fetch...")
    try:
        # Run the sync fetcher in a thread
        import asyncio
        await asyncio.to_thread(fetch_and_maintain_mandi_prices)
        debug_print("[Scheduler] Mandi data fetch completed successfully.")
    except Exception as e:
        debug_print(f"[Scheduler] Mandi data fetch failed: {e}")

async def scheduled_cleanup_task():
    """
    Deletes chat history older than 30 days.
    """
    debug_print("[Scheduler] Running daily chat history cleanup...")
    db = AuthSessionLocal()
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=30)
        deleted_count = db.query(ChatHistory).filter(ChatHistory.timestamp < cutoff_date).delete()
        db.commit()
        debug_print(f"[Scheduler] Cleanup finished. Deleted {deleted_count} messages.")
    except Exception as e:
        debug_print(f"[Scheduler] Cleanup failed: {e}")
    finally:
        db.close()

def start_scheduler():
    """
    Starts the AsyncIOScheduler and schedules the cron jobs.
    """
    if not scheduler.running:
        # Schedule Mandi Data Fetch daily at 06:00 AM (as requested)
        scheduler.add_job(
            scheduled_mandi_task, 
            CronTrigger(hour=6, minute=0), 
            id='mandi_daily_fetch', 
            replace_existing=True
        )
        
        # Schedule History Cleanup daily at 03:00 AM
        scheduler.add_job(
            scheduled_cleanup_task, 
            CronTrigger(hour=3, minute=0), 
            id='history_daily_cleanup', 
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
