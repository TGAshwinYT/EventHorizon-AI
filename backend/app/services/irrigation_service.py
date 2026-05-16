"""
Irrigation Schedule Generator — EventHorizon AI (Phase 3)
=========================================================
Generates a 7-day watering schedule based on crop profiles,
growth stage, weather forecast (rainfall), and satellite NDVI.
"""

from typing import Dict, Any, List, Optional
import datetime

def generate_irrigation_schedule(
    crop_name: str,
    growth_stage: str,
    base_water_need_mm_week: int,
    weather_forecast: List[Dict[str, Any]],
    ndvi_data: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Generate a 7-day irrigation schedule.
    
    Args:
        crop_name: Name of the crop (e.g. 'Rice', 'Tomato')
        growth_stage: Current growth stage
        base_water_need_mm_week: Base mm/week from crop profile
        weather_forecast: 7-day forecast array with 'date' and 'rain_mm' (or pop)
        ndvi_data: Optional NDVI health data to act as a multiplier
        
    Returns:
        Dict with daily schedule and overall summary.
    """
    
    # 1. Adjust base water need based on growth stage
    # Simple multiplier: Seedling (0.6), Vegetative/Flowering (1.2), Maturity (0.5), etc.
    stage_multiplier = 1.0
    stage = growth_stage.lower()
    if "seedling" in stage or "sprout" in stage or "dormancy" in stage:
        stage_multiplier = 0.6
    elif "flowering" in stage or "fruiting" in stage or "heading" in stage or "tasseling" in stage:
        stage_multiplier = 1.3
    elif "maturity" in stage or "harvest" in stage:
        stage_multiplier = 0.5
        
    # 2. Adjust based on NDVI (Vegetation Health)
    ndvi_multiplier = 1.0
    if ndvi_data and ndvi_data.get("trend"):
        signal = ndvi_data["trend"].get("signal", "normal")
        if signal in ["drought_alert", "stress_warning", "persistent_decline"]:
            ndvi_multiplier = 1.25  # Increase water if crop is stressed
        elif signal == "greening" or ndvi_data.get("current", {}).get("ndvi", 0) > 0.7:
            ndvi_multiplier = 0.9   # Slightly reduce if lush/recovering well
            
    # Calculate final adjusted weekly need
    adjusted_weekly_need = base_water_need_mm_week * stage_multiplier * ndvi_multiplier
    daily_need = adjusted_weekly_need / 7.0
    
    schedule = []
    total_planned = 0.0
    total_rain_expected = 0.0
    
    # Generate day-by-day plan
    for day in weather_forecast:
        rain_mm = day.get("rain_mm", 0.0)
        pop = day.get("pop", 0.0) # Probability of precipitation
        
        # Estimate expected rain (if rain_mm not provided, use probability * arbitrary max)
        if rain_mm == 0.0 and pop > 0:
            rain_mm = (pop / 100.0) * 10.0 # Estimate 10mm max if pop is high
            
        total_rain_expected += rain_mm
        
        # If it rains more than the daily need, skip irrigation
        if rain_mm >= daily_need * 0.8:
            action = "skip"
            amount_mm = 0.0
            reason = "Sufficient rain expected"
        else:
            # Need to supplement rain
            amount_mm = max(0.0, daily_need - rain_mm)
            action = "water" if amount_mm > 0 else "skip"
            reason = "Supplementing light rain" if rain_mm > 0 else "Normal irrigation"
            
        # Optional: Skip every other day for crops that prefer deep watering
        # (For simplicity, we distribute evenly unless rain interferes)
        
        schedule.append({
            "date": day.get("date", ""),
            "day_name": day.get("day_name", ""),
            "action": action,
            "amount_mm": round(amount_mm, 1),
            "rain_expected_mm": round(rain_mm, 1),
            "reason": reason
        })
        total_planned += amount_mm
        
    return {
        "crop": crop_name,
        "growth_stage": growth_stage,
        "weekly_target_mm": round(adjusted_weekly_need, 1),
        "total_planned_mm": round(total_planned, 1),
        "total_rain_expected_mm": round(total_rain_expected, 1),
        "schedule": schedule,
        "modifiers": {
            "stage_multiplier": round(stage_multiplier, 2),
            "ndvi_multiplier": round(ndvi_multiplier, 2)
        }
    }
