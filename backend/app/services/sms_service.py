import os
from datetime import datetime

# Local directory setup for user sandbox logs
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
USER_MEMORY_DIR = os.path.join(BASE_DIR, "user_memory")
os.makedirs(USER_MEMORY_DIR, exist_ok=True)

SMS_LOG_FILE = os.path.join(USER_MEMORY_DIR, "sms_logs.txt")

def send_sms(to_number: str, message: str) -> bool:
    """
    Dispatches SMS to to_number.
    - Live Mode: Integrates with Twilio API if environment variables are configured.
    - Developer Sandbox Mode: Appends nicely formatted log entries to `backend/user_memory/sms_logs.txt`.
    """
    if not to_number or not message:
        print("[SMS Service] Error: Recipient number or message is empty.")
        return False

    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    from_number = os.getenv("TWILIO_PHONE_NUMBER")
    messaging_service_sid = os.getenv("TWILIO_MESSAGING_SERVICE_SID")

    is_live = bool(account_sid and auth_token and (from_number or messaging_service_sid))

    if is_live:
        try:
            # We import and execute Twilio dynamically to prevent startup failure 
            # if the twilio python package is not in requirements or installed
            from twilio.rest import Client
            client = Client(account_sid, auth_token)
            
            kwargs = {
                "body": message,
                "to": to_number
            }
            if messaging_service_sid:
                kwargs["messaging_service_sid"] = messaging_service_sid
            else:
                kwargs["from_"] = from_number

            client.messages.create(**kwargs)
            print(f"[SMS Service] Live Twilio SMS dispatched successfully to {to_number}")
            return True
        except ImportError:
            print("[SMS Service] Twilio SDK missing. Attempting standard REST HTTP request...")
            try:
                import requests
                # Standard raw HTTP POST request to Twilio API to avoid dependency issues
                twilio_url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
                auth = (account_sid, auth_token)
                data = {
                    "To": to_number,
                    "Body": message
                }
                if messaging_service_sid:
                    data["MessagingServiceSid"] = messaging_service_sid
                else:
                    data["From"] = from_number

                res = requests.post(twilio_url, auth=auth, data=data, timeout=8)
                if res.status_code in [200, 201]:
                    print(f"[SMS Service] Live HTTP Twilio SMS dispatched to {to_number}")
                    return True
                else:
                    print(f"[SMS Service] Live Twilio HTTP request failed: {res.text}")
            except Exception as e:
                print(f"[SMS Service] Live Twilio HTTP dispatch exception: {e}")
        except Exception as e:
            print(f"[SMS Service] Twilio SDK dispatch failed: {e}")

    # Fallback/Local Developer Sandbox Mode
    try:
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = (
            f"==================================================\n"
            f"[SMS LOG] Date: {now_str}\n"
            f"Recipient: {to_number}\n"
            f"Status: SANDBOX FALLBACK (No Twilio config)\n"
            f"Message: {message}\n"
            f"==================================================\n\n"
        )
        
        with open(SMS_LOG_FILE, "a", encoding="utf-8") as f:
            f.write(log_entry)
            
        print(f"\n[SMS SANDBOX DIALER] Message logged successfully for {to_number}!")
        print(f"File: {SMS_LOG_FILE}\n")
        return True
    except Exception as e:
        print(f"[SMS Service] Failed to write sandbox log: {e}")
        return False
