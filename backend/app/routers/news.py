import os
import json
import time
import requests
from fastapi import APIRouter, HTTPException
from app.models.schemas import NewsRequest
from app.services.gemini_service import gemini_service

router = APIRouter()

SERPER_API_KEY = os.getenv("SERPER_API_KEY")

# In-memory cache for daily news: (state, district, language) -> {"timestamp": float, "news": list}
NEWS_CACHE = {}
CACHE_EXPIRY_SECONDS = 12 * 60 * 60  # 12 hours

@router.post('/daily')
def get_daily_news(data: NewsRequest):
    """
    POST /api/news/daily
    Fetch real-time location-specific agricultural news using Google News/Search via Serper
    and format them into structured UI cards using Gemini.
    """
    cache_key = (data.state or "", data.district or "", data.language or "en")
    now = time.time()
    
    # Return cached results if valid
    if cache_key in NEWS_CACHE:
        entry = NEWS_CACHE[cache_key]
        if now - entry["timestamp"] < CACHE_EXPIRY_SECONDS:
            return entry["news"]

    context_data = ""
    sources = []
    
    # 1. Try to fetch news from Serper
    if SERPER_API_KEY:
        try:
            # Try Google News search first
            url = "https://google.serper.dev/news"
            headers = {
                "X-API-KEY": SERPER_API_KEY.strip(),
                "Content-Type": "application/json"
            }
            query = f"agriculture farming subsidies news {data.state} India"
            if data.district:
                query += f" {data.district}"
                
            payload = {
                "q": query,
                "num": 5
            }
            
            response = requests.post(url, headers=headers, json=payload, timeout=10)
            if response.status_code == 200:
                results = response.json()
                news_items = results.get("news", [])
                
                lines = []
                for idx, item in enumerate(news_items):
                    title = item.get("title", "News")
                    snippet = item.get("snippet", "")
                    source = item.get("source", "Google News")
                    date = item.get("date", "Recently")
                    lines.append(f"News {idx+1}: {title} | Source: {source} | Date: {date} | Snippet: {snippet}")
                
                context_data = "\n".join(lines)
                
            # If news search didn't return much, fallback to regular search
            if not context_data:
                search_url = "https://google.serper.dev/search"
                payload = {
                    "q": f"latest agricultural news {data.state} India",
                    "num": 5
                }
                response = requests.post(search_url, headers=headers, json=payload, timeout=10)
                if response.status_code == 200:
                    results = response.json()
                    organic = results.get("organic", [])
                    lines = []
                    for idx, item in enumerate(organic):
                        title = item.get("title", "Reference")
                        snippet = item.get("snippet", "")
                        lines.append(f"Result {idx+1}: Title: {title} | Snippet: {snippet}")
                    context_data = "\n".join(lines)
                    
        except Exception as e:
            print(f"[NEWS WARNING] Failed to search Google: {e}")

    # 2. Structure using Gemini (or generate realistic fallback news if search is disabled/empty)
    prompt = f"""You are an expert agricultural news editor.
Use the following live real-time search results to compile exactly 4 distinct, highly relevant news/advisory cards for a farmer in the state of {data.state}, India.
{f'District: {data.district}' if data.district else ''}

---
SEARCH RESULTS CONTEXT:
{context_data}
---

Your response MUST be in {data.language} language and formatted strictly as a valid JSON array of objects (no markdown fences, no extra text, just raw JSON).
Each object must have these exact keys:
- "category": a short category string in {data.language} (e.g. "MARKET TREND" or "WEATHER ALERT" or "SCHEME UPDATE" or "FARMING ADVICE")
- "title": a brief compelling headline in {data.language} (4-7 words)
- "content": 1-2 sentences summarizing the news or warning in {data.language}
- "time": relative time (e.g. '3h ago', '10:30 AM', 'Yesterday')
- "metric": short metric/warning tag in {data.language} (e.g. '+₹140/Quintal', 'Critical Risk', 'Active', 'New', or similar)
- "source": name of the news source (e.g. 'Krishi Jagran', 'Times of India', 'IMD Forecast', 'State Agri Dept')

If there are no search results or search is disabled, generate 4 realistic, highly relevant agricultural news items for {data.state} based on current seasonal farming topics in India.
Respond with ONLY the JSON array, no formatting, no markdown."""

    try:
        response_text = gemini_service.generate_response(
            message=prompt,
            context="agriculture",
            detected_language=data.language
        )
        cleaned = response_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1]
        if cleaned.endswith("```"):
            cleaned = cleaned.rsplit("```", 1)[0]
        cleaned = cleaned.strip()

        news_list = json.loads(cleaned)
        if not isinstance(news_list, list):
            news_list = [news_list]
        
        # Cache successful news retrieval
        NEWS_CACHE[cache_key] = {
            "timestamp": now,
            "news": news_list
        }
        return news_list
    except Exception as e:
        print(f"[NEWS STATE ERROR] {e}")
        # Return static localized fallbacks if LLM fails
        return [
            {
                "category": "MARKET TREND",
                "title": "Vegetable Prices Surge",
                "content": f"Due to recent local weather changes, vegetable arrivals in {data.state} markets have decreased, leading to a 10% price increase.",
                "time": "2h ago",
                "metric": "+15%",
                "source": "Agri News"
            },
            {
                "category": "FARMING ADVICE",
                "title": "Monsoon Crop Planning",
                "content": "Agriculture department advises farmers to complete land preparation for Kharif sowing and select certified seeds.",
                "time": "5h ago",
                "metric": "Active",
                "source": "KVK Center"
            },
            {
                "category": "SCHEME UPDATE",
                "title": "Subsidies for Solar Pumps",
                "content": "Applications for solar water pump subsidies under the PM-KUSUM scheme are now open for farmers in this region.",
                "time": "1d ago",
                "metric": "Apply Now",
                "source": "State Gov"
            },
            {
                "category": "WEATHER WARNING",
                "title": "Unseasonal Rain Expected",
                "content": "IMD predicts light to moderate showers in parts of the district. Ensure harvested crops are kept in dry shelters.",
                "time": "Yesterday",
                "metric": "Alert",
                "source": "IMD Forecast"
            }
        ]
