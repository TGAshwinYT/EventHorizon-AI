"""
seed_history.py

Reads today's real records from the mandi_rates table and clones them
for the past 4 days (with realistic price variation) to build a 5-day
rolling history.

OGD API does not support historical date filtering reliably — this is
the pragmatic alternative to simulate a 5-day dataset.
"""

import os
import sys
import random
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.getcwd())

from app.database import MandiSessionLocal
from app.models import MandiRate


def vary_price(price: int, pct: float) -> int:
    """Return price +/- pct% with some randomness."""
    delta = price * pct * random.uniform(0.5, 1.5)
    direction = random.choice([-1, 1])
    return max(0, int(price + direction * delta))


def seed():
    today_str = datetime.now().strftime("%d/%m/%Y")
    db = MandiSessionLocal()

    try:
        # Fetch today's records as the baseline
        today_records = db.query(MandiRate).filter(
            MandiRate.arrival_date == today_str
        ).all()

        if not today_records:
            print(f"No records found for today ({today_str}). Run the OGD fetch first.")
            return

        print(f"Found {len(today_records)} records for {today_str} to use as template.")

        # Build past 4 days (days 1..4 ago, i.e. today is day 0)
        past_dates = [
            (datetime.now() - timedelta(days=i)).strftime("%d/%m/%Y")
            for i in range(1, 5)
        ]

        inserted_total = 0
        for past_date in past_dates:
            # Check if we already have records for this date
            existing_count = db.query(MandiRate).filter(
                MandiRate.arrival_date == past_date
            ).count()

            if existing_count > 0:
                print(f"  {past_date}: {existing_count} records already exist. Skipping.")
                continue

            # Clone today's records with slight price variation
            batch = []
            for r in today_records:
                # Each day further back gets a slightly different price trend
                variation_pct = 0.03  # 3% drift per day
                new_modal = vary_price(r.modal_price, variation_pct)
                new_min   = vary_price(r.min_price,   variation_pct)
                new_max   = vary_price(r.max_price,   variation_pct)

                batch.append(MandiRate(
                    state=r.state,
                    district=r.district,
                    market=r.market,
                    commodity=r.commodity,
                    variety=r.variety,
                    arrival_date=past_date,
                    min_price=min(new_min, new_modal),
                    max_price=max(new_max, new_modal),
                    modal_price=new_modal,
                ))

            db.bulk_save_objects(batch)
            db.commit()
            print(f"  {past_date}: Inserted {len(batch)} records.")
            inserted_total += len(batch)

        print(f"\nDone. {inserted_total} historical records inserted across {len(past_dates)} days.")

    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        import traceback; traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
