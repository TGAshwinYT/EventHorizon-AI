from sqlalchemy import Column, Integer, String, Text, DateTime, Date, ForeignKey, UniqueConstraint, Float, Index
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
    crops = Column(Text, nullable=True) # Stored as comma-separated or JSON string
    alerts_enabled = Column(Integer, default=1) # 0=False, 1=True
    onboarding_completed = Column(Integer, default=0) # Using Integer as Boolean for SQLite compatibility (0=False, 1=True)
    
    # SMS Alerts Offline Preferences
    phone_number = Column(String, nullable=True)
    sms_alerts_enabled = Column(Integer, default=0) # 0=Disabled, 1=Enabled
    sms_cooldown_days = Column(Integer, default=7) # Default to 7 days
    last_sms_sent_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class MandiRate(MandiBase):
    __tablename__ = "mandi_prices"

    # Composite Primary Key matching the actual database columns (since no 'id' column exists)
    state = Column(String, primary_key=True, index=True)
    district = Column(String, primary_key=True, index=True)
    market = Column(String, primary_key=True, index=True)
    commodity = Column(String, primary_key=True, index=True)
    variety = Column(String, primary_key=True, nullable=True)
    arrival_date = Column(Date, primary_key=True, index=True)
    
    min_price = Column(Integer)
    max_price = Column(Integer)
    modal_price = Column(Integer)
    
    # Additional index definitions for optimized search queries
    __table_args__ = (
        Index('idx_mandi_commodity_state', 'commodity', 'state', 'arrival_date'),
        Index('idx_mandi_commodity_district', 'commodity', 'district', 'arrival_date'),
        Index('idx_mandi_commodity_market', 'commodity', 'market', 'arrival_date'),
        Index('idx_mandi_search', 'commodity', 'state', 'district', 'arrival_date'),
    )

class NDVIReading(MandiBase):
    __tablename__ = "ndvi_readings"

    id = Column(Integer, primary_key=True, index=True)
    latitude = Column(Float, index=True)
    longitude = Column(Float, index=True)
    state = Column(String, index=True, nullable=True)
    district = Column(String, index=True, nullable=True)
    crop_name = Column(String, index=True, nullable=True)
    date = Column(Date, index=True)
    ndvi_value = Column(Float)

    # Unique constraint so we don't save duplicate readings for the same coordinates, crop, and date
    __table_args__ = (
        UniqueConstraint('latitude', 'longitude', 'crop_name', 'date', name='uix_ndvi_reading'),
    )

