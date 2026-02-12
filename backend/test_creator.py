from sqlalchemy import create_engine
import pg8000
import os
from dotenv import load_dotenv

load_dotenv(override=True)

url = os.getenv("DATABASE_URL")
print(f"Testing with creator function for URL: {url}")

# Parse URL
# postgresql+pg8000://postgres:admin@localhost:5432/eventhorizon_ai
import urllib.parse
parsed = urllib.parse.urlparse(url or "")
dbname = parsed.path.lstrip("/")
user = parsed.username
password = parsed.password
host = parsed.hostname
port = parsed.port or 5432

def creator():
    return pg8000.connect(
        user=user,
        password=password,
        host=host,
        port=port,
        database=dbname
    )

try:
    # Use 'postgresql' dialect with our custom creator
    engine = create_engine("postgresql://", creator=creator)
    with engine.connect() as conn:
        print("Connected successfully using CUSTOM CREATOR!")
except Exception as e:
    print(f"Failed even with custom creator: {e}")
    import traceback
    traceback.print_exc()
