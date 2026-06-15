"""
NDVI ML Service — EventHorizon AI
=================================
Predicts future Normalized Difference Vegetation Index (NDVI) values for crops.
Uses Meta's Prophet for advanced time-series forecasting, with a fallback
to Scikit-Learn Linear Regression with seasonal components if Prophet is unavailable.
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple

# Try importing Prophet
try:
    from prophet import Prophet
    import logging
    # Suppress cmdstanpy / prophet logging
    logging.getLogger('prophet').setLevel(logging.ERROR)
    logging.getLogger('cmdstanpy').setLevel(logging.ERROR)
    PROPHET_AVAILABLE = True
except ImportError:
    PROPHET_AVAILABLE = False

# Import Scikit-Learn
try:
    from sklearn.linear_model import Ridge
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False


def _extract_seasonal_features(dates: List[datetime]) -> Tuple[np.ndarray, np.ndarray]:
    """Helper to compute sine/cosine day of year features for seasonality."""
    days = np.array([d.timetuple().tm_yday for d in dates])
    # Map 1-365 day of year to 0-2pi radians
    angles = 2 * np.pi * days / 365.25
    return np.sin(angles), np.cos(angles)


def forecast_ndvi_sklearn(history: List[Dict[str, Any]], periods_to_predict: int = 3) -> List[Dict[str, Any]]:
    """
    Fallback forecasting using Scikit-Learn Ridge Regression with seasonal components.
    Works perfectly even on small historical datasets.
    """
    if not SKLEARN_AVAILABLE:
        # Simplest arithmetic fallback if even sklearn is missing
        return _forecast_arithmetic_fallback(history, periods_to_predict)

    try:
        # Parse history
        parsed = []
        for p in history:
            dt = datetime.strptime(p["date"], "%Y-%m-%d")
            parsed.append((dt, p["ndvi"]))
        
        # Sort by date
        parsed.sort(key=lambda x: x[0])
        
        dates = [x[0] for x in parsed]
        y = np.array([x[1] for x in parsed])
        
        # Build features: Time Index + Seasonal Day-of-Year Sin/Cos
        # We represent time as days elapsed since the first data point
        start_date = dates[0]
        time_index = np.array([(d - start_date).days for d in dates])
        
        sin_season, cos_season = _extract_seasonal_features(dates)
        
        # Feature Matrix: [time, sin_season, cos_season]
        X = np.column_stack((time_index, sin_season, cos_season))
        
        # Fit Ridge Regression (L2 regularization makes it very stable on small datasets)
        model = Ridge(alpha=1.0)
        model.fit(X, y)
        
        # Generate future dates (MODIS 16-day increments)
        latest_date = dates[-1]
        future_dates = [latest_date + timedelta(days=16 * (i + 1)) for i in range(periods_to_predict)]
        
        future_time_index = np.array([(d - start_date).days for d in future_dates])
        f_sin_season, f_cos_season = _extract_seasonal_features(future_dates)
        
        X_future = np.column_stack((future_time_index, f_sin_season, f_cos_season))
        
        # Predict
        preds = model.predict(X_future)
        
        # Clip predictions to valid NDVI bounds [0.0, 1.0] for vegetation
        preds = np.clip(preds, 0.0, 1.0)
        
        predictions = []
        for i, dt in enumerate(future_dates):
            ndvi_pred = round(float(preds[i]), 4)
            predictions.append({
                "date": dt.strftime("%Y-%m-%d"),
                "date_label": dt.strftime("%d %b"),
                "ndvi": ndvi_pred,
                "is_forecast": True,
                "method": "sklearn_ridge"
            })
            
        return predictions
    except Exception as e:
        print(f"[NDVI ML] Sklearn forecast failed: {e}")
        return _forecast_arithmetic_fallback(history, periods_to_predict)


def forecast_ndvi_prophet(history: List[Dict[str, Any]], periods_to_predict: int = 3) -> List[Dict[str, Any]]:
    """
    Forecasting using Meta's Prophet model.
    """
    if not PROPHET_AVAILABLE:
        return forecast_ndvi_sklearn(history, periods_to_predict)

    try:
        # Prepare DataFrame for Prophet
        df = pd.DataFrame([
            {"ds": pd.to_datetime(p["date"]), "y": p["ndvi"]}
            for p in history
        ])
        
        # Fit model
        # Enable yearly seasonality if we have at least 1 year of data, otherwise disable
        has_year_data = (df["ds"].max() - df["ds"].min()).days >= 300
        
        model = Prophet(
            yearly_seasonality=has_year_data,
            weekly_seasonality=False,
            daily_seasonality=False,
            changepoint_prior_scale=0.05
        )
        model.fit(df)
        
        # Create future dataframe (MODIS updates every 16 days)
        future = model.make_future_dataframe(periods=periods_to_predict, freq='16D', include_history=False)
        
        # Forecast
        forecast = model.predict(future)
        
        # Parse future predictions
        predictions = []
        for _, row in forecast.iterrows():
            dt = row["ds"].to_pydatetime()
            ndvi_pred = round(float(np.clip(row["yhat"], 0.0, 1.0)), 4)
            predictions.append({
                "date": dt.strftime("%Y-%m-%d"),
                "date_label": dt.strftime("%d %b"),
                "ndvi": ndvi_pred,
                "is_forecast": True,
                "method": "prophet"
            })
            
        return predictions
    except Exception as e:
        print(f"[NDVI ML] Prophet forecast failed: {e}")
        return forecast_ndvi_sklearn(history, periods_to_predict)


def _forecast_arithmetic_fallback(history: List[Dict[str, Any]], periods_to_predict: int = 3) -> List[Dict[str, Any]]:
    """Simple linear extrapolation fallback if all libraries fail."""
    if len(history) < 2:
        # Constant value fallback
        val = history[0]["ndvi"] if history else 0.4
        latest_date = datetime.strptime(history[0]["date"], "%Y-%m-%d") if history else datetime.utcnow()
        return [
            {
                "date": (latest_date + timedelta(days=16 * (i + 1))).strftime("%Y-%m-%d"),
                "date_label": (latest_date + timedelta(days=16 * (i + 1))).strftime("%d %b"),
                "ndvi": round(val, 4),
                "is_forecast": True,
                "method": "arithmetic_constant"
            } for i in range(periods_to_predict)
        ]

    # Calculate mean difference
    ndvis = [p["ndvi"] for p in history]
    diffs = np.diff(ndvis)
    avg_diff = float(np.mean(diffs))
    
    latest_val = ndvis[-1]
    latest_date = datetime.strptime(history[-1]["date"], "%Y-%m-%d")
    
    predictions = []
    for i in range(periods_to_predict):
        val = max(0.0, min(1.0, latest_val + avg_diff * (i + 1)))
        dt = latest_date + timedelta(days=16 * (i + 1))
        predictions.append({
            "date": dt.strftime("%Y-%m-%d"),
            "date_label": dt.strftime("%d %b"),
            "ndvi": round(val, 4),
            "is_forecast": True,
            "method": "arithmetic_linear"
        })
    return predictions


def generate_ml_advisory(history: List[Dict[str, Any]], forecast: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Analyzes historical trends and forecasted values to construct a predictive warning
    and advisory alert for the farmer.
    """
    if not history or not forecast:
        return {
            "severity": "info",
            "title": "📡 Insufficient Prediction Data",
            "message": "Predictive ML analysis requires more historical readings to initialize."
        }

    current_ndvi = history[-1]["ndvi"]
    future_ndvis = [f["ndvi"] for f in forecast]
    min_future_ndvi = min(future_ndvis)
    max_future_ndvi = max(future_ndvis)
    final_future_ndvi = future_ndvis[-1]
    
    # Calculate difference between current and predicted end value
    predicted_change = final_future_ndvi - current_ndvi
    
    # 1. Critical drop prediction (Drought / Pest stress anomaly)
    if min_future_ndvi < 0.35 and predicted_change < -0.10:
        return {
            "severity": "critical",
            "title": "🚨 ML Warning: Crop Stress Predicted",
            "message": (
                f"Our ML model predicts a significant crop health decline from {current_ndvi:.2f} "
                f"down to {final_future_ndvi:.2f} over the next 48 days. This indicates critical "
                f"water stress or pest vulnerability. Increase soil moisture monitoring and prepare "
                f"irrigation backups."
            )
        }
    
    # 2. Moderate drop/browning warning
    if predicted_change < -0.05:
        return {
            "severity": "warning",
            "title": "📉 Predicted Health Decline",
            "message": (
                f"Vegetation index is predicted to drop by {abs(predicted_change):.2f} "
                f"in the coming weeks. Health may decrease from {current_ndvi:.2f} to {final_future_ndvi:.2f}. "
                f"Check for seasonal factors, nutrient deficits, or initial pest indicators."
            )
        }
        
    # 3. Growth/recovery signal
    if predicted_change > 0.05:
        return {
            "severity": "positive",
            "title": "🌱 Predicted Crop Growth",
            "message": (
                f"Strong greening trend predicted! Crop health is expected to rise from "
                f"{current_ndvi:.2f} to {final_future_ndvi:.2f} (+{predicted_change:.2f}) over the next "
                f"6 weeks. Conditions are highly optimal."
            )
        }
        
    # 4. Stable prediction
    return {
        "severity": "positive",
        "title": "✅ Crop Health Stable",
        "message": (
            f"Crop health is predicted to remain stable. Forecasted NDVI in 48 days is "
            f"{final_future_ndvi:.2f} (current: {current_ndvi:.2f}). Continue standard agricultural practices."
        )
    }
