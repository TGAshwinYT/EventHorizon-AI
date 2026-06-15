"""
NDVI ML Service Verification Script — EventHorizon AI
======================================================
Tests the forecasting models (Prophet and Scikit-Learn fallback) and advisory generator.
"""

import sys
import os
from datetime import datetime, timedelta

# Ensure backend directory is in python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.ndvi_ml_service import (
    forecast_ndvi_prophet,
    forecast_ndvi_sklearn,
    generate_ml_advisory,
    PROPHET_AVAILABLE,
    SKLEARN_AVAILABLE
)

def create_mock_history(trend_type="declining", start_val=0.6, periods=6):
    """Generate mock NDVI history with 16-day increments."""
    history = []
    base_date = datetime.utcnow() - timedelta(days=16 * periods)
    
    for i in range(periods):
        date_str = (base_date + timedelta(days=16 * i)).strftime("%Y-%m-%d")
        date_label = (base_date + timedelta(days=16 * i)).strftime("%d %b")
        
        # Calculate mock ndvi value based on trend type
        if trend_type == "declining":
            # Decreasing trend (stress alert)
            ndvi = max(0.15, start_val - 0.05 * i)
        elif trend_type == "improving":
            # Increasing trend (growth signal)
            ndvi = min(0.85, start_val + 0.05 * i)
        else:
            # Stable trend (normal status)
            ndvi = start_val + (0.01 if i % 2 == 0 else -0.01)
            
        history.append({
            "date": date_str,
            "date_label": date_label,
            "ndvi": round(ndvi, 4)
        })
    return history

def run_tests():
    # Ensure stdout supports UTF-8 to print emojis on Windows
    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass
    print("=" * 60)
    print("NDVI ML FORECASTING SERVICE TEST SUITE")
    print("=" * 60)
    print(f"Prophet Available: {PROPHET_AVAILABLE}")
    print(f"Scikit-Learn Available: {SKLEARN_AVAILABLE}")
    print("-" * 60)

    trends = ["declining", "improving", "stable"]
    
    for trend in trends:
        print(f"\n[TEST] Evaluating trend scenario: '{trend.upper()}'")
        history = create_mock_history(trend_type=trend, start_val=0.55 if trend == "declining" else 0.4, periods=6)
        
        print("Historical Data:")
        for pt in history:
            print(f"  Date: {pt['date']} ({pt['date_label']}) | NDVI: {pt['ndvi']}")

        # Test Sklearn Forecast
        print("\nTesting Scikit-Learn Ridge Fallback:")
        sklearn_forecast = forecast_ndvi_sklearn(history, periods_to_predict=3)
        for pt in sklearn_forecast:
            print(f"  Forecast Date: {pt['date']} ({pt['date_label']}) | Predicted NDVI: {pt['ndvi']} | Method: {pt['method']}")
        
        # Test Prophet Forecast (if available)
        prophet_forecast = None
        if PROPHET_AVAILABLE:
            print("\nTesting Prophet Forecast:")
            prophet_forecast = forecast_ndvi_prophet(history, periods_to_predict=3)
            for pt in prophet_forecast:
                print(f"  Forecast Date: {pt['date']} ({pt['date_label']}) | Predicted NDVI: {pt['ndvi']} | Method: {pt['method']}")
        else:
            print("\nProphet not installed/available. Skipping Prophet forecast test.")
            
        # Use whichever forecast succeeded
        active_forecast = prophet_forecast if prophet_forecast else sklearn_forecast
        
        # Test Advisory
        print("\nGenerating ML Predictive Advisory:")
        advisory = generate_ml_advisory(history, active_forecast)
        print(f"  Severity: {advisory.get('severity')}")
        print(f"  Title: {advisory.get('title')}")
        print(f"  Message: {advisory.get('message')}")
        print("-" * 60)

if __name__ == "__main__":
    run_tests()
