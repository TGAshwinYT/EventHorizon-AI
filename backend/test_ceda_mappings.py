import requests
import json

API_KEY = "a9dcaba5b4de96acdc292c457f7a1612fa85c5f017e77f66c8a2e75b4bb87140"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}
BASE_URL = "https://api.ceda.ashoka.edu.in/v1/agmarknet"

def fetch_mappings():
    print("Fetching commodities...")
    r = requests.get(f"{BASE_URL}/commodities", headers=HEADERS)
    with open("ceda_commodities.json", "w") as f:
        json.dump(r.json(), f, indent=2)

    print("Fetching geographies...")
    r = requests.get(f"{BASE_URL}/geographies", headers=HEADERS)
    with open("ceda_geographies.json", "w") as f:
        json.dump(r.json(), f, indent=2)

fetch_mappings()
print("Done")
