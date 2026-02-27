import requests
import sys

API_KEY = "a9dcaba5b4de96acdc292c457f7a1612fa85c5f017e77f66c8a2e75b4bb87140"

def try_endpoint(url):
    print(f"Trying: {url}")
    headers = {"Authorization": f"Token {API_KEY}"}
    try:
        r = requests.get(url, headers=headers, timeout=5)
        print("Status:", r.status_code)
        if r.status_code == 200:
            print(r.json()[:200] if isinstance(r.json(), str) else str(r.json())[:200])
        elif r.status_code in [401, 403]:
            # Maybe bearer?
            headers = {"Authorization": f"Bearer {API_KEY}"}
            r = requests.get(url, headers=headers, timeout=5)
            print("With Bearer:", r.status_code)
        else:
            print("Response:", r.text[:200])
    except Exception as e:
        print("Error:", e)

urls = [
    "https://api.ceda.ashoka.edu.in/agmarknet/prices",
    "https://api.ceda.ashoka.edu.in/api/agmarknet/prices",
    "https://api.ceda.ashoka.edu.in/api/v1/agmarknet/prices",
    "https://api.ceda.ashoka.edu.in/api/prices",
    "https://api.ceda.ashoka.edu.in/amd/prices",
    "https://api.ceda.ashoka.edu.in/agmarknet/markets",
    "https://api.ceda.ashoka.edu.in/agmarknet/commodities",
]

for u in urls:
    try_endpoint(u)
    print("-" * 40)
