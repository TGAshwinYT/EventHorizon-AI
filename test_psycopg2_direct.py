import psycopg2
import sys

# Connection details
config = {
    "host": "aws-1-ap-south-1.pooler.supabase.com",
    "port": 6543,
    "user": "postgres.omkjkxjqyajebafbrcoc",
    "password": "ruthramoorthy05",
    "database": "postgres",
    "sslmode": "require"
}

print(f"Testing direct psycopg2 connection with config: {config}")

try:
    conn = psycopg2.connect(**config)
    print("SUCCESS: Connected via psycopg2!")
    conn.close()
except Exception as e:
    print(f"FAILED: {e}")
