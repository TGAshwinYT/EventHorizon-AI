
import requests
import json
import sys

def test_tamil_response():
    url = "http://127.0.0.1:8000/api/chat/"
    headers = {"Content-Type": "application/json"}
    payload = {
        "message": "Tell me about tomato",
        "language": "ta",
        "voice_enabled": False
    }

    try:
        print(f"Sending request to {url} with payload: {payload}")
        response = requests.post(url, headers=headers, json=payload)
        
        if response.status_code == 200:
            data = response.json()
            response_text = data.get("response_text", "")
            print(f"\nResponse Text: {response_text}\n")
            
            # Simple check for Tamil characters
            # Tamil Unicode Block: 0Bs80 to 0BFF
            if any('\u0B80' <= c <= '\u0BFF' for c in response_text):
                print("PASSED: Response contains Tamil characters.")
            else:
                print("FAILED: Response does NOT contain Tamil characters.")
                print(f"Detected content: {response_text[:100]}...")
                sys.exit(1)
        else:
            print(f"FAILED: Status code {response.status_code}")
            print(response.text)
            sys.exit(1)
            
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)

if __name__ == "__main__":
    test_tamil_response()
