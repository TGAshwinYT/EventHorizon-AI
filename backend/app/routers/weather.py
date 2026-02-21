import os
import requests
from fastapi import APIRouter, Query, HTTPException
from datetime import datetime, timedelta
from typing import List, Dict, Any

router = APIRouter()

@router.get('/')
def get_weather_forecast(
    state: str = Query(..., description="State Name"),
    district: str = Query(..., description="District Name")
):
    """Fetch 5-day hyper-local agri-weather forecast from OpenWeatherMap"""
    api_key = os.getenv("OPENWEATHERMAP_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Weather API key not configured")

    # 1. Get Coordinates for the District, State, India
    geocode_url = f"http://api.openweathermap.org/geo/1.0/direct?q={district},{state},IN&limit=1&appid={api_key}"
    geo_response = requests.get(geocode_url)
    if not geo_response.ok or not geo_response.json():
        # Fallback to search query for district only if specific one fails
        geocode_url = f"http://api.openweathermap.org/geo/1.0/direct?q={district},IN&limit=1&appid={api_key}"
        geo_response = requests.get(geocode_url)
        if not geo_response.ok or not geo_response.json():
            raise HTTPException(status_code=404, detail="Location not found")
            
    geo_data = geo_response.json()[0]
    lat = geo_data['lat']
    lon = geo_data['lon']

    # 2. Get 5-Day / 3-Hour Forecast
    forecast_url = f"http://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&appid={api_key}&units=metric"
    forecast_response = requests.get(forecast_url)
    if not forecast_response.ok:
        raise HTTPException(status_code=500, detail="Failed to fetch weather data")
        
    forecast_data = forecast_response.json()
    
    # 3. Process and aggregate data into 5 daily summaries
    daily_summaries = {}
    
    for item in forecast_data['list']:
        # item['dt_txt'] is like "2024-02-21 15:00:00"
        date_str = item['dt_txt'].split(' ')[0] 
        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
        
        if date_str not in daily_summaries:
            daily_summaries[date_str] = {
                'date_obj': date_obj,
                'temp_max': item['main']['temp_max'],
                'temp_min': item['main']['temp_min'],
                'humidity_list': [item['main']['humidity']],
                'wind_speed_list': [item['wind']['speed'] * 3.6], # m/s to km/h
                'wind_deg_list': [item['wind']['deg']],
                'pop_list': [item.get('pop', 0)], # Probability of precipitation 0-1
                'weather_ids': [item['weather'][0]['id']]
            }
        else:
            daily_summaries[date_str]['temp_max'] = max(daily_summaries[date_str]['temp_max'], item['main']['temp_max'])
            daily_summaries[date_str]['temp_min'] = min(daily_summaries[date_str]['temp_min'], item['main']['temp_min'])
            daily_summaries[date_str]['humidity_list'].append(item['main']['humidity'])
            daily_summaries[date_str]['wind_speed_list'].append(item['wind']['speed'] * 3.6)
            daily_summaries[date_str]['wind_deg_list'].append(item['wind']['deg'])
            daily_summaries[date_str]['pop_list'].append(item.get('pop', 0))
            daily_summaries[date_str]['weather_ids'].append(item['weather'][0]['id'])

    # Format the response
    result = []
    today = datetime.now().date()
    
    def get_wind_direction(degrees):
        dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
        ix = int((degrees + 11.25) / 22.5)
        return dirs[ix % 16]
        
    def get_icon_name(weather_ids):
        # Extremely simplified icon mapping
        avg_id = sum(weather_ids) / len(weather_ids)
        if avg_id < 600: return 'rain'
        elif avg_id < 700: return 'snow'
        elif avg_id < 800: return 'cloud'
        elif avg_id == 800: return 'sun'
        else: return 'partly-cloudy'

    # Filter out past days, strictly return exactly next 5 days
    sorted_dates = sorted(daily_summaries.keys())
    
    for date_str in sorted_dates:
        summary = daily_summaries[date_str]
        
        # Don't return past days
        if summary['date_obj'].date() < today:
            continue
            
        if len(result) >= 5:
            break
            
        # Averages
        avg_humidity = sum(summary['humidity_list']) / len(summary['humidity_list'])
        avg_wind_speed = sum(summary['wind_speed_list']) / len(summary['wind_speed_list'])
        avg_wind_deg = sum(summary['wind_deg_list']) / len(summary['wind_deg_list'])
        max_pop = max(summary['pop_list']) * 100 # percentage
        
        is_today = summary['date_obj'].date() == today
        is_tomorrow = summary['date_obj'].date() == today + timedelta(days=1)
        
        if is_today:
            date_label = f"Today, {summary['date_obj'].strftime('%d %b')}"
        elif is_tomorrow:
            date_label = f"Tomorrow, {summary['date_obj'].strftime('%d %b')}"
        else:
            date_label = summary['date_obj'].strftime('%a, %d %b')
            
        result.append({
            "date": date_label,
            "icon": get_icon_name(summary['weather_ids']),
            "tempMax": int(round(summary['temp_max'])),
            "tempMin": int(round(summary['temp_min'])),
            "rainProb": int(round(max_pop)),
            "humidity": int(round(avg_humidity)),
            "windSpeed": int(round(avg_wind_speed)),
            "windDir": get_wind_direction(avg_wind_deg),
            "isToday": is_today
        })
        
    return result
