from sqlalchemy.dialects import registry
import sys

print(f"Python: {sys.executable}")
try:
    import pg8000
    print(f"pg8000: {pg8000.__version__}")
except ImportError:
    print("pg8000 not installed")

print("Attempting to load sqlalchemy dialect 'postgresql.pg8000'...")
try:
    dialect = registry.load("postgresql.pg8000")
    print(f"Dialect loaded: {dialect}")
except Exception as e:
    print(f"FAILED to load dialect: {e}")
    import traceback
    traceback.print_exc()

try:
    import scramp
    print(f"scramp: {scramp.__version__}")
except ImportError:
    print("scramp NOT installed (required for pg8000 SCRAM auth)")
