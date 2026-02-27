import requests
import json

API_KEY = "a9dcaba5b4de96acdc292c457f7a1612fa85c5f017e77f66c8a2e75b4bb87140"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}
BASE_URL = "https://api.ceda.ashoka.edu.in/v1/agmarknet"

def fetch_prices():
    payload = {
        "commodity_id": 1,
        "state_id": 8,
        "district_id": [104],
        "from_date": "2024-03-01",
        "to_date": "2024-03-02"
    }
    r = requests.post(f"{BASE_URL}/prices", headers=HEADERS, json=payload)
    data = r.json()
    print("Preview district level:", data['output']['data'] if 'output' in data else data)

fetch_prices()
