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
            
        db.delete(user)
        db.commit()
        db.close()
        return {"message": "Profile deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[PROFILE DELETE ERROR] {e}")
        raise HTTPException(status_code=500, detail="Failed to delete profile")
