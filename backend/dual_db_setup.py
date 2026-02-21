import os
from datetime import date
from typing import Any, Dict, List
from sqlalchemy import create_engine, Column, Integer, String, Float, Date, UniqueConstraint
from sqlalchemy.orm import sessionmaker, declarative_base

# ==========================================
# Part 1: The Database Setup
# ==========================================

# Retrieve Database URLs from environment variables
# (Fallback to local dummy URLs for demonstration if not set)
SUPABASE_URL = os.getenv("SUPABASE_URL", "postgresql+pg8000://user:pass@supabase-host/db")
NEON_URL = os.getenv("NEON_URL", "postgresql+pg8000://user:pass@neon-host/db")

# Create two separate connection engines
# pool_pre_ping=True helps prevent connection drops
user_engine = create_engine(SUPABASE_URL, pool_pre_ping=True)
mandi_engine = create_engine(NEON_URL, pool_pre_ping=True)

# Create two distinct SessionLocal factories
UserSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=user_engine)
MandiSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=mandi_engine)

# Create two distinct declarative_base() classes to isolate table metadata
# This ensures that UserBase.metadata.create_all() only creates User tables
UserBase = declarative_base()
MandiBase = declarative_base()


# ==========================================
# Part 2: The Models
# ==========================================

class User(UserBase):
    """
    User model for the Supabase database.
    Stores core authentication and search history/preferences.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    preferred_state = Column(String, nullable=True)


class MandiPrice(MandiBase):
    """
    MandiPrice model for the Neon database.
    Stores high-volume daily agricultural commodity prices.
    Uses a 7-day rolling window in the database.
    """
    __tablename__ = "mandi_prices"

    id = Column(Integer, primary_key=True, index=True)
    state = Column(String, index=True, nullable=False)
    district = Column(String, nullable=False)
    market = Column(String, nullable=False)
    commodity = Column(String, index=True, nullable=False)
    modal_price = Column(Float, nullable=False)
    update_date = Column(Date, default=date.today)

    # Unique constraint on (state, district, market, commodity) 
    # This is critical for PostgreSQL 'ON CONFLICT DO UPDATE' UPSERT operations
    __table_args__ = (
        UniqueConstraint('state', 'district', 'market', 'commodity', name='uix_market_commodity'),
    )


# ==========================================
# Part 3: The Data Bridge Function
# ==========================================

def get_user_dashboard(user_id: int) -> dict:
    """
    Fetches the user's preferred state from the Supabase DB,
    then fetches the latest commodity prices for that state from the Neon DB.
    
    Returns a combined dictionary.
    """
    dashboard_data: Dict[str, Any] = {
        "user_id": user_id,
        "preferred_state": None,
        "mandi_prices": [],
        "error": None
    }

    # 1. Open a session to the Supabase database
    with UserSessionLocal() as user_session:
        try:
            # Fetch the User's preferred_state
            user = user_session.query(User).filter(User.id == user_id).first()
            
            if not user:
                dashboard_data["error"] = "User not found"
                return dashboard_data
                
            dashboard_data["preferred_state"] = user.preferred_state
            
        except Exception as e:
            dashboard_data["error"] = f"Error fetching user: {str(e)}"
            return dashboard_data

    # If the user has no preferred state, there's nothing more to fetch
    if not dashboard_data["preferred_state"]:
        return dashboard_data

    # 2. Open a session to the Neon database
    with MandiSessionLocal() as mandi_session:
        try:
            # Query the MandiPrice table for all prices matching that preferred_state
            prices = mandi_session.query(MandiPrice).filter(
                MandiPrice.state == dashboard_data["preferred_state"]
            ).all()
            
            # Format the data into a usable dictionary structure
            dashboard_data["mandi_prices"] = [
                {
                    "district": p.district,
                    "market": p.market,
                    "commodity": p.commodity,
                    "modal_price": p.modal_price,
                    "update_date": p.update_date.isoformat() if p.update_date else None
                }
                for p in prices
            ]
            
        except Exception as e:
            dashboard_data["error"] = f"Error fetching mandi prices: {str(e)}"

    return dashboard_data

# ==========================================
# Example Usage / Initialization (Optional)
# ==========================================
if __name__ == "__main__":
    # In a real environment, you would use Alembic for migrations.
    # For a quick bootstrap, you can create the tables directly if they don't exist:
    
    # print("Creating tables in Supabase...")
    # UserBase.metadata.create_all(bind=user_engine)
    
    # print("Creating tables in Neon...")
    # MandiBase.metadata.create_all(bind=mandi_engine)
    
    print("Setup complete. Ready to bridge data.")
