import os
import ssl
import re
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.engine.url import make_url

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Define default PostgreSQL fallback DBs for local development if variables missing
DEFAULT_AUTH_URL = "postgresql+pg8000://postgres:root@localhost:5432/auth_db"
DEFAULT_MANDI_URL = "postgresql+pg8000://postgres:root@localhost:5432/mandi_db"

# Retrieve DB URLs - strip whitespace as Render/Prisma/Neon can sometimes have it
AUTH_DATABASE_URL = os.getenv("AUTH_DATABASE_URL", DEFAULT_AUTH_URL).strip()
MANDI_DATABASE_URL = os.getenv("MANDI_DATABASE_URL", DEFAULT_MANDI_URL).strip()

# Helper to clean and format URLs
def format_db_url(url: str) -> str:
    if not url:
        return ""
    
    url = url.strip()
    
    # Identify if we should use psycopg2 (requested for Supabase) or pg8000
    is_supabase = "supabase" in url.lower()
    dialect = "+psycopg2" if is_supabase else "+pg8000"
    
    # Standardize scheme using regex to be robust against variations
    # This handles postgres://, postgresql://, postgresql+xxx://
    url = re.sub(r"^postgres(ql)?(\+\w+)?://", f"postgresql{dialect}://", url, count=1)
    
    return url

def mask_db_url(url: str) -> str:
    try:
        u = make_url(url)
        return f"{u.drivername}://{u.username}:***@{u.host}:{u.port}/{u.database}"
    except:
        return "MALFORMED_URL (Could not parse)"

# Clean the URLs
AUTH_DATABASE_URL = format_db_url(AUTH_DATABASE_URL)
MANDI_DATABASE_URL = format_db_url(MANDI_DATABASE_URL)

if not AUTH_DATABASE_URL:
    raise ValueError("AUTH_DATABASE_URL is not set or empty.")
if not MANDI_DATABASE_URL:
    raise ValueError("MANDI_DATABASE_URL is not set or empty.")

# Args for Postgres
auth_engine_args = {"pool_size": 10, "max_overflow": 20, "pool_pre_ping": True}
mandi_engine_args = {"pool_size": 20, "max_overflow": 30, "pool_pre_ping": True}

# For Remote DBs, we handle SSL context manually ONLY for pg8000
# Psycopg2 (Supabase) handles SSL via the connection string (?sslmode=require)
def apply_ssl_if_needed(url: str, engine_args: dict):
    # Only apply to external hosts
    if any(host in url for host in ["neon.tech", "supabase", "aws.com", "elephantsql.com"]):
        # If using pg8000, we must strip params and use ssl_context
        if "pg8000" in url:
            cleaned_url = url.split("?")[0]
            ssl_context = ssl.create_default_context()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            engine_args["connect_args"] = {"ssl_context": ssl_context}
            return cleaned_url
        
        # If using psycopg2 (Supabase), it supports the URL parameters directly
        # so we don't strictly need to modify the URL or args if sslmode is in the string.
        # But we ensure it's there if missing.
        if "psycopg2" in url and "sslmode" not in url:
            separator = "&" if "?" in url else "?"
            return f"{url}{separator}sslmode=require"
            
    return url

AUTH_DATABASE_URL = apply_ssl_if_needed(AUTH_DATABASE_URL, auth_engine_args)
MANDI_DATABASE_URL = apply_ssl_if_needed(MANDI_DATABASE_URL, mandi_engine_args)

# Final debug logging before engine creation
logger.info(f"Initializing Auth DB with URL: {mask_db_url(AUTH_DATABASE_URL)}")
logger.info(f"Initializing Mandi DB with URL: {mask_db_url(MANDI_DATABASE_URL)}")

try:
    auth_engine = create_engine(AUTH_DATABASE_URL, **auth_engine_args)
    mandi_engine = create_engine(MANDI_DATABASE_URL, **mandi_engine_args)
except Exception as e:
    logger.error(f"CRITICAL: Failed to create engine. URL was: {mask_db_url(AUTH_DATABASE_URL if 'auth' in str(e).lower() else MANDI_DATABASE_URL)}")
    raise e

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
