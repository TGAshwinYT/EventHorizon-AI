import os
import re
import urllib.parse
from dotenv import load_dotenv
from sqlalchemy.engine.url import make_url

# Copying the logic from database.py to see what happens
def format_db_url(name, url: str) -> str:
    if not url:
        return ""
    
    url = url.strip()
    
    # If it looks like a key-value string (Supabase style), parse it
    if "user=" in url and "host=" in url:
        try:
            kv = {}
            matches = re.findall(r'(\w+)\s*=\s*([^\s]+)', url)
            for k, v in matches:
                kv[k.lower()] = v
            
            if all(k in kv for k in ['user', 'password', 'host', 'dbname']):
                port = kv.get('port', '5432')
                safe_password = urllib.parse.quote_plus(kv['password'])
                url = f"postgresql+psycopg2://{kv['user']}:{safe_password}@{kv['host']}:{port}/{kv['dbname']}"
        except Exception as e:
            print(f"Error parsing kv: {e}")
    
    # Standardize dialect
    is_supabase = "supabase" in url.lower()
    dialect = "+psycopg2" if is_supabase else "+pg8000"
    
    # Standardize scheme using regex
    if re.match(r"^postgres(ql)?(\+\w+)?://", url):
        url = re.sub(r"^postgres(ql)?(\+\w+)?://", f"postgresql{dialect}://", url, count=1)
    
    return url

def test_debug():
    load_dotenv(override=True)
    raw_url = os.getenv("AUTH_DATABASE_URL")
    print(f"RAW URL: {raw_url}")
    
    formatted = format_db_url("AUTH", raw_url)
    print(f"FORMATTED URL: {formatted}")
    
    try:
        u = make_url(formatted)
        print(f"SQLAlchemy parsed username: {u.username}")
        print(f"SQLAlchemy parsed host: {u.host}")
        print(f"SQLAlchemy parsed port: {u.port}")
        print(f"SQLAlchemy parsed database: {u.database}")
    except Exception as e:
        print(f"SQLAlchemy parse error: {e}")

if __name__ == "__main__":
    test_debug()
