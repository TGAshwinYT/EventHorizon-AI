import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Define default PostgreSQL fallback DBs for local development if variables missing
DEFAULT_AUTH_URL = "postgresql+pg8000://postgres:root@localhost:5432/auth_db"
DEFAULT_MANDI_URL = "postgresql+pg8000://postgres:root@localhost:5432/mandi_db"

# Retrieve DB URLs
AUTH_DATABASE_URL = os.getenv("AUTH_DATABASE_URL", DEFAULT_AUTH_URL)
MANDI_DATABASE_URL = os.getenv("MANDI_DATABASE_URL", DEFAULT_MANDI_URL)

# Note: Check connection string scheme for SQLAlchemy
if AUTH_DATABASE_URL and AUTH_DATABASE_URL.startswith("postgres://"):
    AUTH_DATABASE_URL = AUTH_DATABASE_URL.replace("postgres://", "postgresql://", 1)
if MANDI_DATABASE_URL and MANDI_DATABASE_URL.startswith("postgres://"):
    MANDI_DATABASE_URL = MANDI_DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Args for Postgres
auth_engine_args = {"pool_size": 10, "max_overflow": 20, "pool_pre_ping": True}
mandi_engine_args = {"pool_size": 20, "max_overflow": 30, "pool_pre_ping": True}

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
