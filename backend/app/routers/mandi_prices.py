from fastapi import APIRouter, Query, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_mandi_db
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

router = APIRouter()

@router.get('/recent')
def get_recent_mandi_prices(
    commodity: str = Query(..., description="Commodity Name"),
    market: str = Query(..., description="Market Name"),
    db: Session = Depends(get_mandi_db)
):
    """Get the 5 most recent days of modal prices and calculate % change from yesterday."""
    
    # Query the 5 most recent dates for the commodity and market (or state/district)
    # Note: Using raw SQL for precise control over DATE casting and limits
    query = text("""
        SELECT arrival_date, AVG(min_price), AVG(max_price), AVG(modal_price) 
        FROM mandi_prices
        WHERE commodity = :commodity AND (state = :market OR district = :market OR market = :market)
        GROUP BY arrival_date
        ORDER BY arrival_date DESC
        LIMIT 5;
    """)
    
    result = db.execute(query, {"commodity": commodity, "market": market}).fetchall()
    
    if not result:
        raise HTTPException(status_code=404, detail="No data found for the specified commodity and market.")
        
    recent_data = []
    for row in result:
        # Expected tuple: (arrival_date, min_price, max_price, modal_price)
        date_str = row[0].strftime("%Y-%m-%d") if isinstance(row[0], datetime) else str(row[0])
        recent_data.append({
            "date": date_str,
            "min_price": int(round(float(row[1]))) if row[1] else 0,
            "max_price": int(round(float(row[2]))) if row[2] else 0,
            "modal_price": int(round(float(row[3]))) if row[3] else 0
        })
        
    # Calculate percentage change between Today (index 0) and Yesterday (index 1) if available
    percent_change = 0.0
    if len(recent_data) >= 2:
        today_price = float(recent_data[0]["modal_price"])
        yesterday_price = float(recent_data[1]["modal_price"])
        
        if yesterday_price > 0: # Avoid division by zero
            percent_change = ((today_price - yesterday_price) / yesterday_price) * 100
            
    return {
        "today_modal_price": recent_data[0]["modal_price"],
        "percent_change": round(percent_change, 2),
        "recent_data": recent_data
    }


@router.get('/forecast')
def get_mandi_forecast(
    commodity: str = Query(..., description="Commodity Name"),
    market: str = Query(..., description="Market Name"),
    db: Session = Depends(get_mandi_db)
):
    """Fetch 30 days of historical data and predict 5 days into the future using Linear Regression."""
    
    # Query 30 days of historical data
    query = text("""
        SELECT arrival_date, AVG(modal_price) as modal_price 
        FROM mandi_prices
        WHERE commodity = :commodity AND (state = :market OR district = :market OR market = :market)
        AND modal_price IS NOT NULL
        GROUP BY arrival_date
        ORDER BY arrival_date DESC
        LIMIT 30;
    """)
    
    result = db.execute(query, {"commodity": commodity, "market": market}).fetchall()
    
    if not result:
         raise HTTPException(status_code=404, detail="Not enough historical data available for forecast.")
         
    # Reverse it so it is in chronological order (oldest to newest) for regression calculation
    result.reverse()
    
    historical_data = []
    prices = []
    dates = []
    
    for row in result:
        # Handle string or date objects gracefully
        if hasattr(row[0], "strftime"):
             curr_date = row[0]
        elif isinstance(row[0], str):
             # Try parsing standard YYYY-MM-DD
             try:
                 curr_date = datetime.strptime(row[0], "%Y-%m-%d").date()
             except ValueError:
                 try:
                     # Fallback to DD/MM/YYYY just in case
                     curr_date = datetime.strptime(row[0], "%d/%m/%Y").date()
                 except ValueError:
                     continue # Skip unparseable dates
        else:
             curr_date = row[0]
             
        historical_data.append({
            "date": curr_date.strftime("%Y-%m-%d"),
            "price": float(row[1]),
            "isForecast": False
        })
        prices.append(float(row[1]))
        dates.append(curr_date)
        
    if len(prices) < 2:
         return historical_data # Can't do regression on < 2 points
         
    # --- Linear Regression Setup ---
    # Create an array of X integers representing days [0, 1, 2, ..., n]
    x_days = np.arange(len(prices))
    y_prices = np.array(prices)
    
    # Fit line (degree 1)
    # Returns coefficients [slope, intercept]
    coefficients = np.polyfit(x_days, y_prices, 1)
    predictor = np.poly1d(coefficients)
    
    forecast_data = []
    last_historical_date = dates[-1]
    last_x = x_days[-1]
    
    # Predict for the next 5 days
    for i in range(1, 6):
        future_x = last_x + i
        predicted_price = predictor(future_x)
        future_date = last_historical_date + timedelta(days=i)
        
        # Ensure prices don't dip below 0
        predicted_price = max(0, predicted_price)
        
        forecast_data.append({
            "date": future_date.strftime("%Y-%m-%d"),
            "price": round(predicted_price, 2),
            "isForecast": True
        })
        
    return historical_data + forecast_data
