import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Any

def run_prophet_forecast(df_daily_dict: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Runs the Prophet model fitting and prediction in a background process."""
    df_daily = pd.DataFrame(df_daily_dict)
    df_daily['ds'] = pd.to_datetime(df_daily['ds'])
    
    from prophet import Prophet
    import logging
    # Suppress prophet logging
    logging.getLogger('prophet').setLevel(logging.WARNING)
    
    m = Prophet(daily_seasonality=False, yearly_seasonality=False, weekly_seasonality=False)
    m.fit(df_daily)

    future = m.make_future_dataframe(periods=7)
    forecast = m.predict(future)

    future_forecast = forecast.tail(7)
    
    forecast_json = []
    for _, row in future_forecast.iterrows():
        pred_price = row['yhat']
        min_hist = df_daily['y'].min()
        pred_price = max(min_hist * 0.5, pred_price)
        
        forecast_json.append({
            "date": row['ds'].strftime("%Y-%m-%d"),
            "price": int(round(pred_price)),
            "isForecast": True
        })
    return forecast_json

def run_linear_forecast(df_daily_dict: List[Dict[str, Any]], periods: int = 7) -> List[Dict[str, Any]]:
    """Runs a simple linear regression fallback forecast in a background process."""
    df_daily = pd.DataFrame(df_daily_dict)
    df_daily['ds'] = pd.to_datetime(df_daily['ds'])
    
    x = np.arange(len(df_daily))
    y = df_daily['y'].values
    
    z = np.polyfit(x, y, 1)
    p = np.poly1d(z)
    
    forecast_json = []
    last_date = df_daily['ds'].max()
    min_hist = df_daily['y'].min()
    
    for i in range(1, periods + 1):
        future_date = last_date + timedelta(days=i)
        pred_price = p(len(x) - 1 + i)
        
        import random
        noise = pred_price * random.uniform(-0.02, 0.02)
        pred_price += noise
        pred_price = max(min_hist * 0.5, pred_price)
        
        forecast_json.append({
            "date": future_date.strftime("%Y-%m-%d"),
            "price": int(round(pred_price)),
            "isForecast": True
        })
    return forecast_json

def run_linear_forecast_mandi(prices: List[float], dates: List[str]) -> List[Dict[str, Any]]:
    """Runs linear regression forecasting for Mandi prices endpoint in a background process."""
    parsed_dates = []
    for d in dates:
        if isinstance(d, str):
            parsed_dates.append(datetime.strptime(d, "%Y-%m-%d").date())
        else:
            parsed_dates.append(d)
            
    x_days = np.arange(len(prices))
    y_prices = np.array(prices)
    
    coefficients = np.polyfit(x_days, y_prices, 1)
    predictor = np.poly1d(coefficients)
    
    forecast_data = []
    last_historical_date = parsed_dates[-1]
    last_x = x_days[-1]
    
    for i in range(1, 6):
        future_x = last_x + i
        predicted_price = predictor(future_x)
        future_date = last_historical_date + timedelta(days=i)
        
        predicted_price = max(0.0, predicted_price)
        
        forecast_data.append({
            "date": future_date.strftime("%Y-%m-%d"),
            "price": float(round(predicted_price, 2)),
            "isForecast": True
        })
    return forecast_data
