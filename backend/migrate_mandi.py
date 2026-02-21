import os
import ssl
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
from app.models import MandiRate, MandiBase

env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=env_path, override=True)

# URL configuration
LOCAL_URL = os.getenv("LOCAL_MANDI_URL")
NEON_URL = os.getenv("MANDI_DATABASE_URL")

if not LOCAL_URL or not NEON_URL:
    raise ValueError("Missing database URLs in .env file. Ensure LOCAL_MANDI_URL and MANDI_DATABASE_URL are set.")

print(f"Connecting to Local: {LOCAL_URL}")
print(f"Connecting to Neon: {NEON_URL}")

# Engines
local_engine = create_engine(LOCAL_URL)

# For Neon + pg8000, we strip the sslmode/channel_binding and use connect_args
neon_url_clean = NEON_URL.split('?')[0]
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

neon_engine = create_engine(
    neon_url_clean,
    connect_args={"ssl_context": ssl_context}
)

# Sessions
LocalSession = sessionmaker(bind=local_engine)
NeonSession = sessionmaker(bind=neon_engine)

def migrate():
    # 1. Create tables in Neon if they don't exist
    print("Initializing schema on Neon...")
    MandiBase.metadata.create_all(bind=neon_engine)
    
    local_db = LocalSession()
    neon_db = NeonSession()
    
    try:
        # 2. Fetch all data from local
        print("Fetching local data...")
        rates = local_db.query(MandiRate).all()
        print(f"Found {len(rates)} records locally.")
        
        # 3. Insert into Neon
        if rates:
            print("Migrating to Neon (this might take a moment)...")
            # Clear existing just in case or we could use merge
            # neon_db.query(MandiRate).delete()
            
            for rate in rates:
                # Create a new instance without the local ID to avoid PK conflicts if any
                new_rate = MandiRate(
                    state=rate.state,
                    district=rate.district,
                    market=rate.market,
                    commodity=rate.commodity,
                    variety=rate.variety,
                    arrival_date=rate.arrival_date,
                    min_price=rate.min_price,
                    max_price=rate.max_price,
                    modal_price=rate.modal_price,
                    created_at=rate.created_at,
                    updated_at=rate.updated_at
                )
                neon_db.add(new_rate)
            
            neon_db.commit()
            print("Migration successful!")
        else:
            print("No data found to migrate.")
            
    except Exception as e:
        print(f"Migration failed: {e}")
        neon_db.rollback()
    finally:
        local_db.close()
        neon_db.close()

if __name__ == "__main__":
    migrate()
