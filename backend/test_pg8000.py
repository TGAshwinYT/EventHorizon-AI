try:
    import pg8000
    print(f"pg8000 version: {pg8000.__version__}")
except ImportError:
    print("pg8000 not installed")

try:
    import sqlalchemy
    print(f"SQLAlchemy version: {sqlalchemy.__version__}")
    from sqlalchemy import create_engine
    engine = create_engine("postgresql+pg8000://postgres:admin@localhost:5432/eventhorizon_ai")
    with engine.connect() as conn:
        print("Connected successfully!")
except Exception as e:
    print(f"Error: {e}")
