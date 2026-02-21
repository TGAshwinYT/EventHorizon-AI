from app.database import MandiSessionLocal
from app.models import MandiRate

def check():
    db = MandiSessionLocal()
    try:
        count = db.query(MandiRate).count()
        print(f"Successfully connected to Neon! Record count: {count}")
        if count > 0:
            sample = db.query(MandiRate).first()
            print(f"Sample record: {sample.state} - {sample.commodity} - {sample.modal_price}")
    except Exception as e:
        print(f"Connection to Neon failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check()
