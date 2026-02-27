import requests
import json

API_KEY = "a9dcaba5b4de96acdc292c457f7a1612fa85c5f017e77f66c8a2e75b4bb87140"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}
BASE_URL = "https://api.ceda.ashoka.edu.in/v1/agmarknet"

def fetch_prices():
    # Fetch Wheat (id: 1) in Rajasthan (id: 8) for the last 5 days
    payload = {
        "commodity_id": 1,
        "state_id": 8,
        "from_date": "2024-03-01",
        "to_date": "2024-03-02"
    }
    r = requests.post(f"{BASE_URL}/prices", headers=HEADERS, json=payload)
    print("Status:", r.status_code)
    try:
        data = r.json()
        print("Response Keys:", data.keys())
        if 'data' in data:
            print("Preview 1st record:", data['data'][0] if data['data'] else "No data")
        else:
            print("Preview:", str(data)[:500])
    except Exception as e:
        print("Text:", r.text[:500])

fetch_prices()
