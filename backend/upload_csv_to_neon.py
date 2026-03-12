import os
import pandas as pd
import psycopg2
from psycopg2 import extras
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Path to the CSV file in the Downloads folder
CSV_FILE_PATH = r"d:\Ashwin\AI\master_mandi_35_days.csv"

def get_db_connection():
    database_url = os.getenv("MANDI_DATABASE_URL")
    if not database_url:
        raise ValueError("MANDI_DATABASE_URL environment variable is not set. Please check your .env file.")
    # psycopg2 requires 'postgresql://' instead of 'postgresql+pg8000://'
    database_url = database_url.replace("postgresql+pg8000://", "postgresql://")
    return psycopg2.connect(database_url)

def create_table_if_missing(conn):
    query = """
    CREATE TABLE IF NOT EXISTS mandi_prices (
        state VARCHAR,
        district VARCHAR,
        market VARCHAR,
        commodity VARCHAR,
        variety VARCHAR,
        arrival_date DATE,
        min_price NUMERIC,
        max_price NUMERIC,
        modal_price NUMERIC,
        UNIQUE(state, district, market, commodity, variety, arrival_date)
    );
    """
    with conn.cursor() as cur:
        cur.execute(query)
    conn.commit()

def upload_data(conn):
    print(f"Reading CSV from {CSV_FILE_PATH}...")
    try:
        df = pd.read_csv(CSV_FILE_PATH)
    except FileNotFoundError:
        print(f"Error: The file {CSV_FILE_PATH} was not found.")
        print("Please ensure the CSV is named 'master_mandi_35_days.csv' and is in your Downloads folder.")
        return

    # Ensure column names exactly match expected format and map correctly
    # If the CSV columns are slightly different, this will enforce standardizing before accessing
    expected_cols = ['state', 'district', 'market', 'commodity', 'variety', 'arrival_date', 'min_price', 'max_price', 'modal_price']
    
    # Check if all required columns exist (ignoring case for safety, though pandas is case-sensitive)
    missing_cols = [col for col in expected_cols if col not in df.columns]
    if missing_cols:
        print(f"Error: Missing columns in CSV: {missing_cols}")
        print(f"Found columns: {list(df.columns)}")
        return

    print("Parsing dates and formatting data...")
    # Convert arrival_date from DD/MM/YYYY to SQL DATE YYYY-MM-DD
    df['arrival_date'] = pd.to_datetime(df['arrival_date'], format='%d/%m/%Y').dt.strftime('%Y-%m-%d')
    
    # Drop duplicates to prevent ON CONFLICT errors during batch insert
    df = df.drop_duplicates(subset=['state', 'district', 'market', 'commodity', 'variety', 'arrival_date'], keep='last')
    
    # Handle any NaN prices (converting pandas NaN to Python None for db insertion)
    df = df.where(pd.notnull(df), None)

    # Reorder columns to match the INSERT statement exactly
    df = df[expected_cols]

    # Convert dataframe into list of tuples
    records = [tuple(row) for row in df.itertuples(index=False, name=None)]

    upsert_query = """
        INSERT INTO mandi_prices (
            state, district, market, commodity, variety, arrival_date, min_price, max_price, modal_price
        ) VALUES %s
        ON CONFLICT (state, district, market, commodity, variety, arrival_date)
        DO UPDATE SET
            min_price = EXCLUDED.min_price,
            max_price = EXCLUDED.max_price,
            modal_price = EXCLUDED.modal_price;
    """

    print("Executing batch UPSERT into Neon database...")
    with conn.cursor() as cur:
        extras.execute_values(cur, upsert_query, records, page_size=1000)
    conn.commit()
    print(f"Success! {len(records)} rows processed and successfully inserted/updated.")

def main():
    conn = None
    try:
        print("Connecting to Neon PostgreSQL database...")
        conn = get_db_connection()
        print("Successfully connected.")
        
        create_table_if_missing(conn)
        print("Table schema verified.")
        
        upload_data(conn)
        
    except psycopg2.Error as e:
        print(f"Database error occurred: {e}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
    finally:
        if conn:
            conn.close()
            print("Database connection closed.")

if __name__ == "__main__":
    main()
