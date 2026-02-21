from apscheduler.schedulers.background import BackgroundScheduler
from app.services.ogd_api import fetch_ogd_mandi_prices
from app.database import AuthSessionLocal
from app.models import ChatHistory, User
from datetime import datetime, timedelta
import atexit

scheduler = BackgroundScheduler()

def cleanup_history_job():
    """
    Deletes chat history older than 30 days.
    """
    print("[Scheduler] Running history cleanup...")
    db = AuthSessionLocal()
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=30)
        deleted_count = db.query(ChatHistory).filter(ChatHistory.timestamp < cutoff_date).delete()
        db.commit()
        print(f"[Scheduler] Cleanup finished. Deleted {deleted_count} old messages.")
    except Exception as e:
        print(f"[Scheduler] Cleanup failed: {e}")
    finally:
        db.close()

def start_scheduler():
    """
    Starts the background scheduler.
    """
    if not scheduler.running:
        # Schedule Mandi Data Fetch every 12 hours
        scheduler.add_job(fetch_ogd_mandi_prices, 'interval', hours=12, id='mandi_fetch_job')
        
        # Schedule History Cleanup daily
        scheduler.add_job(cleanup_history_job, 'interval', days=1, id='history_cleanup_job')
        
        # Run Mandi Fetch immediately on startup for first-time population
        # (Optional: might slow down startup, but good for demo)
        # scheduler.add_job(fetch_ogd_mandi_prices, 'date', run_date=datetime.now() + timedelta(seconds=10), id='mandi_startup_fetch')

        scheduler.start()
        print("[Scheduler] Background scheduler started.")

        # Shut down the scheduler when exiting the app
        atexit.register(scheduler.shutdown)
