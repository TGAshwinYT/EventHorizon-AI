import os
import requests
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

SERPER_API_KEY = os.getenv("SERPER_API_KEY")

class SearchService:
    def __init__(self):
        if SERPER_API_KEY:
            self.enabled = True
            print("[SEARCH SERVICE] Initialized successfully using Serper API.")
        else:
            self.enabled = False
            print("[SEARCH SERVICE] Warning: SERPER_API_KEY not configured. Running in mock mode.")

    def search_google(self, query: str, num_results: int = 5) -> str:
        """
        Execute Google Search via Serper API and return a clean text summary of organic results.
        """
        if not self.enabled or not SERPER_API_KEY:
            print("[SEARCH SERVICE] Serper API not enabled or key missing. Returning default message.")
            return "No Google Search results found. Serper API key not configured."

        try:
            url = "https://google.serper.dev/search"
            headers = {
                "X-API-KEY": SERPER_API_KEY.strip(),
                "Content-Type": "application/json"
            }
            payload = {
                "q": query,
                "num": num_results
            }

            print(f"[SEARCH SERVICE] Querying Google Search via Serper for: '{query}'")
            response = requests.post(url, headers=headers, json=payload, timeout=12)

            if response.status_code == 200:
                data = response.json()
                organic_results = data.get("organic", [])
                
                if not organic_results:
                    return f"Google Search returned 0 organic results for: '{query}'"

                lines = []
                for index, item in enumerate(organic_results, 1):
                    title = item.get("title", "No Title")
                    link = item.get("link", "")
                    snippet = item.get("snippet", "")
                    lines.append(f"Result {index}:\nTitle: {title}\nLink: {link}\nSnippet: {snippet}\n")
                
                context_string = "\n".join(lines)
                print(f"[SEARCH SERVICE SUCCESS] Retreived {len(organic_results)} results successfully.")
                return context_string
            else:
                print(f"[SEARCH SERVICE ERROR] Serper API responded with {response.status_code}: {response.text}")
                return f"Google search error (status {response.status_code})."
        except Exception as e:
            print(f"[SEARCH SERVICE EXCEPTION] Failed to search google: {e}")
            return f"Failed to search: {str(e)}"

search_service = SearchService()
