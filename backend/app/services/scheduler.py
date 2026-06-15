import os
import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from app.services.ceda_api import fetch_ceda_mandi_prices
from app.database import MandiSessionLocal, AuthSessionLocal, debug_print
from datetime import datetime, timedelta
from app.models import User

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

async def scheduled_sms_alerts_task():
    """
    Asynchronous daily task to check user regional risk parameters & government schemes,
    verifying cooldown interval settings, and dispatching localized alerts offline.
    """
    debug_print("[Scheduler] Starting scheduled daily SMS alert dispatcher...")
    db = AuthSessionLocal()
    try:
        # Query all active users requesting offline SMS notifications
        users = db.query(User).filter(User.sms_alerts_enabled == 1, User.phone_number != None).all()
        debug_print(f"[Scheduler] Found {len(users)} users subscribed to SMS alerts.")
        
        from app.services.crypto_service import decrypt_phone
        from app.services.sms_service import send_sms
        from app.services.risk_assessment_service import compute_risk_assessment
        from app.services.gemini_service import gemini_service
        
        for user in users:
            # 1. Verification of user custom cooldown threshold (1-7 days)
            cooldown_val = user.sms_cooldown_days or 7
            if user.last_sms_sent_at:
                elapsed = datetime.utcnow() - user.last_sms_sent_at
                if elapsed < timedelta(days=cooldown_val):
                    debug_print(f"[Scheduler] Skipping user {user.username} - Cooldown active ({elapsed.days} days elapsed, threshold is {cooldown_val} days).")
                    continue
            
            # 2. Decrypt plain recipient phone number
            recipient = decrypt_phone(user.phone_number)
            if not recipient:
                debug_print(f"[Scheduler] Skipping user {user.username} - Decryption returned empty phone.")
                continue
                
            # 3. Retrieve regional risk parameters for registered crops
            state_val = user.state or "Tamil Nadu"
            district_val = user.district or "Erode"
            mandal_val = user.mandal or ""
            from app.services.geocoding import get_coords_with_place
            lat, lon = await get_coords_with_place(state_val, district_val, mandal_val)
            if lat is None or lon is None:
                lat, lon = 11.341, 77.717

            api_key = os.getenv("OPENWEATHERMAP_API_KEY", "")

            crops_list = [c.strip() for c in user.crops.split(",")] if user.crops else ["Rice"]
            risk_summaries = []
            async with httpx.AsyncClient(timeout=15.0) as client:
                for crop in crops_list[:2]: # Limit crops to keep text compressed
                    try:
                        res = await compute_risk_assessment(
                            lat=lat,
                            lon=lon,
                            crop=crop,
                            location_label=f"{mandal_val}, {district_val}, {state_val}" if mandal_val else f"{district_val}, {state_val}",
                            api_key=api_key,
                            client=client,
                        )
                        risk_summaries.append(f"{crop}: {res.get('overall_label', 'Moderate')}")
                    except Exception as e:
                        debug_print(f"[Scheduler] Alert risk calculation failed for {crop}: {e}")
                        risk_summaries.append(f"{crop}: Moderate")
                    
            risk_str = ", ".join(risk_summaries)
            
            # 4. Generate compressed local alert via Gemini AI
            lang_name = "English"
            closing_phrase = "Ask Horizon!"
            if user.language == "ta":
                lang_name = "Tamil"
                closing_phrase = "Enna doubt? Kelunga!"
            elif user.language == "hi":
                lang_name = "Hindi"
                closing_phrase = "Enna doubt? Kelunga!"
            
            prompt = (
                f"You are an agricultural SMS alerts pipeline. Summarize these regional crop risks for this farmer into a single, high-fidelity message:\n"
                f"- Farmer Location: {user.district or 'Erode'}, {user.state or 'Tamil Nadu'}\n"
                f"- Crop parameters: {risk_str}\n\n"
                f"OUTPUT ONLY the short summary text in {lang_name} language. Must be under 160 characters. Always end exactly with: '{closing_phrase}'."
            )
            
            try:
                sms_raw = gemini_service.generate_response(prompt, context="agriculture")
                sms_text = sms_raw.strip().replace('"', '').replace("'", "")
                if len(sms_text) > 160:
                    sms_text = sms_text[:157] + "..."
                
                # 5. Dispatch offline alert
                success = send_sms(to_number=recipient, message=sms_text)
                if success:
                    user.last_sms_sent_at = datetime.utcnow()
                    db.commit()
                    debug_print(f"[Scheduler] Alert dispatched successfully to {user.username}.")
            except Exception as e:
                db.rollback()
                debug_print(f"[Scheduler] Alert generation/dispatch failed for {user.username}: {e}")
                
    except Exception as e:
        debug_print(f"[Scheduler] SMS scheduled alerts task failure: {e}")
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
        
        # Schedule SMS Alerts daily at 08:00 AM
        scheduler.add_job(
            scheduled_sms_alerts_task,
            CronTrigger(hour=8, minute=0),
            id='sms_alerts_daily',
            replace_existing=True
        )
        
        scheduler.start()
        debug_print("Async Background Scheduler started (Mandi Fetch @ 02:00 AM | SMS Alerts @ 08:00 AM).")

def shutdown_scheduler():
    """
    Shuts down the scheduler cleanly.
    """
    if scheduler.running:
        scheduler.shutdown()
        debug_print("Async Background Scheduler shut down.")
