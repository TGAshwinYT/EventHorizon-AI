import requests
import json

API_KEY = "a9dcaba5b4de96acdc292c457f7a1612fa85c5f017e77f66c8a2e75b4bb87140"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}
BASE_URL = "https://api.ceda.ashoka.edu.in/v1/agmarknet"

def fetch_markets():
    payload = {"commodity_id": 1, "state_id": 8, "district_id": [104]}
    r = requests.post(f"{BASE_URL}/markets", headers=HEADERS, json=payload)
    print("Status:", r.status_code)
    try:
        print("Response Keys:", r.json().keys())
        print("Preview:", str(r.json())[:500])
    except Exception as e:
        print("Text:", r.text[:500])

fetch_markets()
