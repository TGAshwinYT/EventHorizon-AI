from sqlalchemy import Column, Integer, String, Text, DateTime, Date, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import AuthBase, MandiBase

class User(AuthBase):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    display_name = Column(String, nullable=True)
    avatar_url = Column(Text, nullable=True)
    api_key_gemini = Column(String, nullable=True)
    api_key_huggingface = Column(String, nullable=True)
    
    # Onboarding & Profile Info
    language = Column(String, nullable=True)
    state = Column(String, nullable=True)
    district = Column(String, nullable=True)
    mandal = Column(String, nullable=True)
    onboarding_completed = Column(Integer, default=0) # Using Integer as Boolean for SQLite compatibility (0=False, 1=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    chats = relationship("ChatHistory", back_populates="owner", cascade="all, delete")

class ChatHistory(AuthBase):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    message = Column(Text)
    sender = Column(String) # 'user' or 'ai'
    timestamp = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="chats")

class MandiRate(MandiBase):
    __tablename__ = "mandi_prices"

    id = Column(Integer, primary_key=True, index=True)
    state = Column(String, index=True)
    district = Column(String, index=True)
    market = Column(String, index=True)
    commodity = Column(String, index=True)
    variety = Column(String, nullable=True)
    arrival_date = Column(Date)  # Storing as Date type
    
    min_price = Column(Integer)
    max_price = Column(Integer)
    modal_price = Column(Integer)
    
    # Unique Constraint to prevent duplicates for the same market/commodity/date
    __table_args__ = (
        UniqueConstraint('state', 'district', 'market', 'commodity', 'arrival_date', name='uix_mandi_rate'),
    )
