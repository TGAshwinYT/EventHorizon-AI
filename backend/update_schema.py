import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DEFAULT_AUTH_URL = "postgresql+pg8000://postgres:root@localhost:5432/auth_db"
AUTH_DATABASE_URL = os.getenv("AUTH_DATABASE_URL", DEFAULT_AUTH_URL)
if AUTH_DATABASE_URL and AUTH_DATABASE_URL.startswith("postgres://"):
    AUTH_DATABASE_URL = AUTH_DATABASE_URL.replace("postgres://", "postgresql://", 1)

auth_engine = create_engine(AUTH_DATABASE_URL)

def add_columns_safely():
    with auth_engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN display_name VARCHAR;"))
            print("Added display_name column.")
        except Exception as e:
            print(f"Column display_name might already exist: {e}")

        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN avatar_url TEXT;"))
            print("Added avatar_url column.")
        except Exception as e:
            print(f"Column avatar_url might already exist: {e}")

        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;"))
            print("Added updated_at column.")
        except Exception as e:
            print(f"Column updated_at might already exist: {e}")

        conn.commit()
    print("Database migration complete.")

if __name__ == "__main__":
    add_columns_safely()
