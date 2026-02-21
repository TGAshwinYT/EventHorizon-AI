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

class LoginRequest(BaseModel):
    username: str
    password: str

class ResetPasswordRequest(BaseModel):
    username: str
    new_password: str

@router.post('/register', status_code=201)
def register(data: RegisterRequest, db: Session = Depends(get_auth_db)):
    username = data.username
    password = data.password

    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password required")

    existing_user = db.query(User).filter(User.username == username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")

    hashed_pw = get_password_hash(password)
    new_user = User(username=username, password_hash=hashed_pw)
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User registered successfully"}

@router.post('/login')
def login(data: LoginRequest):
    username = data.username
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
    username = data.username
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

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class ImportDataRequest(BaseModel):
    username: str
    language: str | None = None
    history: list[dict]

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
        
        user_data = {
            "username": user.username,
            "display_name": user.display_name,
            "avatar_url": user.avatar_url
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
            
        db.commit()
        db.refresh(user)
        
        user_data = {
            "username": user.username,
            "display_name": user.display_name,
            "avatar_url": user.avatar_url
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
        
@router.post('/import')
def import_data(data: ImportDataRequest, authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
         raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        from app.auth import decode_access_token
        from app.models import ChatHistory
        import datetime
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
            
        imported_count = 0
        for msg in data.history:
            # Simple deduplication check based on text and timestamp matching ignoring ms
            msg_text = msg.get("text")
            msg_sender = msg.get("sender")
            if not msg_text or not msg_sender: continue
            
            # Check if exists
            exists = db.query(ChatHistory).filter(
                ChatHistory.user_id == user.id,
                ChatHistory.message == msg_text,
                ChatHistory.sender == msg_sender
            ).first()
            
            if not exists:
                try: # try parsing time, if fail just use utcnow
                    ts_str = msg.get("timestamp")
                    if ts_str and isinstance(ts_str, str):
                        time_val = datetime.datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                    else:
                        time_val = datetime.datetime.utcnow()
                except:
                    time_val = datetime.datetime.utcnow()
                    
                new_msg = ChatHistory(user_id=user.id, message=msg_text, sender=msg_sender, timestamp=time_val)
                db.add(new_msg)
                imported_count += 1
                
        db.commit()
        db.close()
        return {"message": f"Successfully imported {imported_count} messages."}
    except Exception as e:
        print(f"[IMPORT DATA ERROR] {e}")
        raise HTTPException(status_code=500, detail="Failed to import data")

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
            
        # Delete user (Cascading delete should handle history if configured, 
        # else we explicitly delete history first to be safe)
        from app.models import ChatHistory
        db.query(ChatHistory).filter(ChatHistory.user_id == user.id).delete()
        
        db.delete(user)
        db.commit()
        db.close()
        return {"message": "Profile deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[PROFILE DELETE ERROR] {e}")
        raise HTTPException(status_code=500, detail="Failed to delete profile")
