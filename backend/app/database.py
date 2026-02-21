import os
import ssl
import re
import sys
import logging
import urllib.parse
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.engine.url import make_url

def debug_print(msg):
    sys.stderr.write(f"--- DB_DEBUG: {msg} ---\n")
    sys.stderr.flush()

debug_print("Loading database.py")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Define default PostgreSQL fallback DBs for local development if variables missing
DEFAULT_AUTH_URL = "postgresql+pg8000://postgres:root@localhost:5432/auth_db"
DEFAULT_MANDI_URL = "postgresql+pg8000://postgres:root@localhost:5432/mandi_db"

# Retrieve DB URLs - strip whitespace as Render/Prisma/Neon can sometimes have it
AUTH_DATABASE_URL = os.getenv("AUTH_DATABASE_URL", DEFAULT_AUTH_URL).strip()
MANDI_DATABASE_URL = os.getenv("MANDI_DATABASE_URL", DEFAULT_MANDI_URL).strip()

# Helper to clean and format URLs
def format_db_url(name, url: str) -> str:
    if not url:
        debug_print(f"{name} is EMPTY")
        return ""
    
    url = url.strip()
    
    # If it looks like a key-value string (Supabase style), parse it
    if "user=" in url and "host=" in url:
        debug_print(f"Detected key-value format for {name}. Attempting to parse...")
        try:
            # Match assignments like key=value or key = value
            # We handle potential newlines or multiple spaces between pairs
            kv = {}
            # Use regex to find all key=value pairs, even if values have special chars
            matches = re.findall(r'(\w+)\s*=\s*([^\s]+)', url)
            for k, v in matches:
                kv[k.lower()] = v
            
            if all(k in kv for k in ['user', 'password', 'host', 'dbname']):
                port = kv.get('port', '5432')
                # Escape password to handle special chars like @ or :
                safe_password = urllib.parse.quote_plus(kv['password'])
                # For Supabase, we default to psycopg2
                url = f"postgresql+psycopg2://{kv['user']}:{safe_password}@{kv['host']}:{port}/{kv['dbname']}"
                debug_print(f"Parsed {name} into SQLAlchemy format (with encoded password).")
            else:
                debug_print(f"Incomplete key-value pairs for {name}: {list(kv.keys())}")
        except Exception as e:
            debug_print(f"Failed to parse key-value string for {name}: {e}")

    # Standardize dialect
    is_supabase = "supabase" in url.lower()
    dialect = "+psycopg2" if is_supabase else "+pg8000"
    
    # Standardize scheme using regex to be robust against variations
    if re.match(r"^postgres(ql)?(\+\w+)?://", url):
        url = re.sub(r"^postgres(ql)?(\+\w+)?://", f"postgresql{dialect}://", url, count=1)
    elif not url.startswith("postgresql"):
        # If it doesn't have a protocol at all after parsing attempts, we assume it's just raw
        # but create_engine will still fail later if it's not a URL.
        pass
    
    return url

# Retrieve and clean DB URLs
AUTH_RAW = os.getenv("AUTH_DATABASE_URL", DEFAULT_AUTH_URL)
MANDI_RAW = os.getenv("MANDI_DATABASE_URL", DEFAULT_MANDI_URL)

AUTH_DATABASE_URL = format_db_url("AUTH", AUTH_RAW)
MANDI_DATABASE_URL = format_db_url("MANDI", MANDI_RAW)

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

def safe_create_engine(name, url, args):
    try:
        # Pre-validate with make_url
        u = make_url(url)
        debug_print(f"Validated {name} URL: {u.drivername}://{u.username}:***@{u.host}:{u.port}/{u.database}")
        return create_engine(url, **args)
    except Exception as e:
        debug_print(f"CRITICAL ERROR in {name} engine creation: {str(e)}")
        # If it fails here, show the first few chars of the URL to see if it's weird
        debug_print(f"Start of {name} URL: {url[:15]}... (total len: {len(url)})")
        raise e

auth_engine = safe_create_engine("AUTH", AUTH_DATABASE_URL, auth_engine_args)
mandi_engine = safe_create_engine("MANDI", MANDI_DATABASE_URL, mandi_engine_args)

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
