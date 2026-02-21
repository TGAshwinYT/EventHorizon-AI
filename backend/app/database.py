import os
import ssl
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Define default PostgreSQL fallback DBs for local development if variables missing
DEFAULT_AUTH_URL = "postgresql+pg8000://postgres:root@localhost:5432/auth_db"
DEFAULT_MANDI_URL = "postgresql+pg8000://postgres:root@localhost:5432/mandi_db"

# Retrieve DB URLs
AUTH_DATABASE_URL = os.getenv("AUTH_DATABASE_URL", DEFAULT_AUTH_URL)
MANDI_DATABASE_URL = os.getenv("MANDI_DATABASE_URL", DEFAULT_MANDI_URL)

# Helper to clean and format URLs for pg8000
def format_db_url(url: str, is_mandi: bool = False) -> str:
    if not url:
        return ""
    # Standardize scheme
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+pg8000://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+pg8000://", 1)
    
    # Ensure +pg8000 dialect for consistency across environments
    if "postgresql" in url and "+pg8000" not in url:
        url = url.replace("postgresql://", "postgresql+pg8000://", 1)
        
    return url

# Retrieve and clean DB URLs
AUTH_DATABASE_URL = format_db_url(os.getenv("AUTH_DATABASE_URL", DEFAULT_AUTH_URL))
MANDI_DATABASE_URL = format_db_url(os.getenv("MANDI_DATABASE_URL", DEFAULT_MANDI_URL))

if not AUTH_DATABASE_URL:
    raise ValueError("AUTH_DATABASE_URL is not set or empty.")
if not MANDI_DATABASE_URL:
    raise ValueError("MANDI_DATABASE_URL is not set or empty.")

# Args for Postgres
auth_engine_args = {"pool_size": 10, "max_overflow": 20, "pool_pre_ping": True}
mandi_engine_args = {"pool_size": 20, "max_overflow": 30, "pool_pre_ping": True}

# For Remote DBs (Neon/Supabase) + pg8000, we need to handle SSL context manually
def apply_ssl_if_needed(url: str, engine_args: dict):
    # Only apply to external hosts that typically require SSL (Neon, Supabase, etc.)
    if any(host in url for host in ["neon.tech", "supabase", "aws.com", "elephantsql.com"]):
        # Strip query params as pg8000 doesn't support sslmode/channel_binding in URL
        cleaned_url = url.split("?")[0]
        
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        engine_args["connect_args"] = {"ssl_context": ssl_context}
        return cleaned_url
    return url

AUTH_DATABASE_URL = apply_ssl_if_needed(AUTH_DATABASE_URL, auth_engine_args)
MANDI_DATABASE_URL = apply_ssl_if_needed(MANDI_DATABASE_URL, mandi_engine_args)

auth_engine = create_engine(AUTH_DATABASE_URL, **auth_engine_args)
mandi_engine = create_engine(MANDI_DATABASE_URL, **mandi_engine_args)

AuthSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=auth_engine)
MandiSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=mandi_engine)

AuthBase = declarative_base()
MandiBase = declarative_base()

def get_auth_db():
    db = AuthSessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_mandi_db():
    db = MandiSessionLocal()
    try:
        yield db
    finally:
        db.close()
