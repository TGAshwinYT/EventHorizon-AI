from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_auth_db, AuthSessionLocal
from app.models import User
from app.auth import get_password_hash, verify_password, create_access_token

router = APIRouter()

class RegisterRequest(BaseModel):
    username: str
    password: str
    phone_number: str | None = None

class LoginRequest(BaseModel):
    username: str
    password: str

class ResetPasswordRequest(BaseModel):
    username: str
    new_password: str

@router.post('/register', status_code=201)
def register(data: RegisterRequest, db: Session = Depends(get_auth_db)):
    username = data.username.strip() if data.username else ""
    password = data.password
    phone = data.phone_number.strip() if data.phone_number else None

    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password required")

    existing_user = db.query(User).filter(User.username == username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")

    from app.services.crypto_service import encrypt_phone
    encrypted_phone = encrypt_phone(phone) if phone else None
    # If phone is provided, default alerts to enabled (1)
    sms_alerts = 1 if encrypted_phone else 0

    hashed_pw = get_password_hash(password)
    new_user = User(
        username=username,
        password_hash=hashed_pw,
        phone_number=encrypted_phone,
        sms_alerts_enabled=sms_alerts,
        sms_cooldown_days=7
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User registered successfully"}

@router.post('/login')
def login(data: LoginRequest):
    username = data.username.strip() if data.username else ""
    password = data.password

    db: Session = AuthSessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        
        if not user or not verify_password(password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid credentials")

        access_token = create_access_token(data={"sub": user.username})
        return {"access_token": access_token, "token_type": "bearer", "username": user.username}
    finally:
        db.close()

@router.post('/reset-password')
def reset_password(data: ResetPasswordRequest):
    username = data.username.strip() if data.username else ""
    new_password = data.new_password

    if not username or not new_password:
        raise HTTPException(status_code=400, detail="Username and new password required")

    db: Session = AuthSessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        hashed_pw = get_password_hash(new_password)
        user.password_hash = hashed_pw
        db.commit()

        return {"message": "Password reset successfully"}
    finally:
        db.close()
class UpdateProfileRequest(BaseModel):
    display_name: str | None = None
    avatar_url: str | None = None
    language: str | None = None
    state: str | None = None
    district: str | None = None
    mandal: str | None = None
    onboarding_completed: bool | None = None
    phone_number: str | None = None
    sms_alerts_enabled: bool | None = None
    sms_cooldown_days: int | None = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@router.get('/profile')
def get_profile(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
         raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        from app.auth import decode_access_token
        token = authorization.split(" ")[1]
        payload = decode_access_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        username = payload.get("sub")
        db: Session = AuthSessionLocal()
        user = db.query(User).filter(User.username == username).first()
        if not user:
            db.close()
            raise HTTPException(status_code=404, detail="User not found")
        
        from app.services.crypto_service import decrypt_phone, mask_phone_number
        decrypted = decrypt_phone(user.phone_number)
        masked_phone = mask_phone_number(decrypted)
        
        user_data = {
            "username": user.username,
            "display_name": user.display_name,
            "avatar_url": user.avatar_url,
            "language": user.language,
            "state": user.state,
            "district": user.district,
            "mandal": user.mandal,
            "onboarding_completed": bool(user.onboarding_completed),
            "phone_number": masked_phone,
            "sms_alerts_enabled": bool(user.sms_alerts_enabled),
            "sms_cooldown_days": user.sms_cooldown_days or 7
        }
        db.close()
        return user_data
    except Exception as e:
        print(f"[PROFILE GET ERROR] {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch profile")

@router.put('/profile')
def update_profile(data: UpdateProfileRequest, authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
         raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        from app.auth import decode_access_token
        token = authorization.split(" ")[1]
        payload = decode_access_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        username = payload.get("sub")
        db: Session = AuthSessionLocal()
        user = db.query(User).filter(User.username == username).first()
        if not user:
            db.close()
            raise HTTPException(status_code=404, detail="User not found")
            
        if data.display_name is not None:
            user.display_name = data.display_name
        if data.avatar_url is not None:
            user.avatar_url = data.avatar_url
        if data.language is not None:
            user.language = data.language
        if data.state is not None:
            user.state = data.state
        if data.district is not None:
            user.district = data.district
        if data.mandal is not None:
            user.mandal = data.mandal
        if data.onboarding_completed is not None:
            user.onboarding_completed = 1 if data.onboarding_completed else 0
            
        # SMS configurations
        if data.sms_alerts_enabled is not None:
            user.sms_alerts_enabled = 1 if data.sms_alerts_enabled else 0
        if data.sms_cooldown_days is not None:
            user.sms_cooldown_days = max(1, min(7, data.sms_cooldown_days))
        if data.phone_number is not None:
            phone_val = data.phone_number.strip()
            if not phone_val:
                user.phone_number = None
                user.sms_alerts_enabled = 0
            elif "*" not in phone_val:
                from app.services.crypto_service import encrypt_phone
                user.phone_number = encrypt_phone(phone_val)
            
        db.commit()
        db.refresh(user)
        
        from app.services.crypto_service import decrypt_phone, mask_phone_number
        decrypted = decrypt_phone(user.phone_number)
        masked_phone = mask_phone_number(decrypted)
        
        user_data = {
            "username": user.username,
            "display_name": user.display_name,
            "avatar_url": user.avatar_url,
            "language": user.language,
            "state": user.state,
            "district": user.district,
            "mandal": user.mandal,
            "onboarding_completed": bool(user.onboarding_completed),
            "phone_number": masked_phone,
            "sms_alerts_enabled": bool(user.sms_alerts_enabled),
            "sms_cooldown_days": user.sms_cooldown_days or 7
        }
        db.close()
        return {"message": "Profile updated successfully", "user": user_data}
    except Exception as e:
        print(f"[PROFILE UPDATE ERROR] {e}")
        raise HTTPException(status_code=500, detail="Failed to update profile")

@router.post('/change-password')
def change_password(data: ChangePasswordRequest, authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
         raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        from app.auth import decode_access_token
        token = authorization.split(" ")[1]
        payload = decode_access_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        username = payload.get("sub")
        db: Session = AuthSessionLocal()
        user = db.query(User).filter(User.username == username).first()
        if not user:
            db.close()
            raise HTTPException(status_code=404, detail="User not found")
            
        if not verify_password(data.current_password, user.password_hash):
            db.close()
            raise HTTPException(status_code=401, detail="Incorrect current password")
            
        user.password_hash = get_password_hash(data.new_password)
        db.commit()
        db.close()
        return {"message": "Password changed successfully"}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[PASSWORD CHANGE ERROR] {e}")
        raise HTTPException(status_code=500, detail="Failed to change password")
        
@router.delete('/profile')
def delete_profile(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    try:
        from app.auth import decode_access_token # Ensure imported
        token = authorization.split(" ")[1]
        payload = decode_access_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
            
        username = payload.get("sub")
        db: Session = AuthSessionLocal()
        user = db.query(User).filter(User.username == username).first()
        
        if not user:
            db.close()
            raise HTTPException(status_code=404, detail="User not found")
            
        # Delete related chat_history records first due to foreign key constraints in database
        from sqlalchemy import text
        try:
            db.execute(text("DELETE FROM chat_history WHERE user_id = :user_id"), {"user_id": user.id})
        except Exception as db_err:
            print(f"[PROFILE DELETE] Warning deleting chat_history: {db_err}")
            
        db.delete(user)
        db.commit()
        db.close()
        return {"message": "Profile deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[PROFILE DELETE ERROR] {e}")
        raise HTTPException(status_code=500, detail="Failed to delete profile")

@router.get('/notifications')
async def get_live_notifications(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
         raise HTTPException(status_code=401, detail="Unauthorized")
         
    try:
        from app.auth import decode_access_token
        token = authorization.split(" ")[1]
        payload = decode_access_token(token)
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        username = payload.get("sub")
        
        db: Session = AuthSessionLocal()
        user = db.query(User).filter(User.username == username).first()
        if not user:
            db.close()
            raise HTTPException(status_code=404, detail="User not found")
            
        user_state = user.state or "Tamil Nadu"
        user_district = user.district or "Erode"
        user_mandal = user.mandal or ""
        user_crops = [c.strip() for c in user.crops.split(",")] if user.crops else ["Rice"]
        db.close()
        
        notifications = []
        notif_id = 1
        
        # 1. Fetch live weather & pest risk parameters to generate true notifications
        try:
            from app.services.geocoding import get_coords_with_place
            lat, lon = await get_coords_with_place(user_state, user_district, user_mandal)
            if lat is None or lon is None:
                lat, lon = 11.341, 77.717
                
            import os
            import httpx
            from app.services.risk_assessment_service import compute_risk_assessment
            
            api_key = os.getenv("OPENWEATHERMAP_API_KEY", "")
            
            location_label = f"{user_mandal}, {user_district}, {user_state}" if user_mandal else f"{user_district}, {user_state}"
            async with httpx.AsyncClient(timeout=15.0) as client:
                assessment = await compute_risk_assessment(
                    lat=lat,
                    lon=lon,
                    crop=user_crops[0],
                    location_label=location_label,
                    api_key=api_key,
                    client=client
                )
            
            # Add Weather alert if rain is predicted
            rain_total = sum(day.get("rain_mm", 0.0) for day in assessment.get("weather_forecast", []))
            display_loc = user_mandal or user_district
            if rain_total > 5.0:
                notifications.append({
                    "id": notif_id,
                    "type": "weather",
                    "text": f"Rain alert: {rain_total:.1f}mm rain expected in {display_loc} over next 5 days. Postpone immediate fertilizer sprays.",
                    "date": "Today"
                })
                notif_id += 1
                
            # Add Pest alert if pest risk is High or Critical
            pest_risk = assessment.get("risks", {}).get("pest", {})
            pest_label = pest_risk.get("label", "Low")
            if pest_label in ["High", "Critical"]:
                notifications.append({
                    "id": notif_id,
                    "type": "alert",
                    "text": f"High pest threat warning for {user_crops[0]} in {display_loc}. Inspect crops daily and prepare neem oil preventive sprays.",
                    "date": "Today"
                })
                notif_id += 1
                
        except Exception as e:
            print(f"[Notifications Weather Error] {e}")
            
        # 2. Fetch live Mandi rates to check for price surge notifications
        try:
            from app.database import MandiSessionLocal
            from sqlalchemy import text
            mandi_db = MandiSessionLocal()
            
            fetch_crop = "Paddy(Dhan)(Common)" if user_crops[0] == "Rice" else user_crops[0]
            sql = """
                SELECT market, modal_price, arrival_date 
                FROM mandi_prices 
                WHERE state = :state AND commodity = :crop 
                ORDER BY arrival_date DESC LIMIT 2
            """
            result = mandi_db.execute(text(sql), {"state": user_state, "crop": fetch_crop}).fetchall()
            mandi_db.close()
            
            if result and len(result) >= 1:
                market = result[0][0]
                price = int(result[0][1])
                notifications.append({
                    "id": notif_id,
                    "type": "price",
                    "text": f"Mandi rate alert: {user_crops[0]} price is ₹{price:,}/quintal in {market} market.",
                    "date": "Today" if len(notifications) == 0 else "Yesterday"
                })
                notif_id += 1
        except Exception as e:
            print(f"[Notifications Mandi Error] {e}")
            
        # 3. Default fallbacks if no alerts generated
        if not notifications:
            notifications = [
                { "id": 1, "type": "alert", "text": f"Scout fields regularly for {user_crops[0]} crop wellness.", "date": "Today" },
                { "id": 2, "type": "weather", "text": f"Plan irrigation cycle based on {user_district} forecast report.", "date": "Yesterday" }
            ]
            
        return notifications
    except Exception as e:
        print(f"[LIVE NOTIFICATIONS ERROR] {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch notifications")

