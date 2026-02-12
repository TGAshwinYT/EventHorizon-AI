import os
import requests
from typing import Optional

class STTService:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv('HUGGINGFACE_API_KEY')
        # Multilingual IndicConformer model
        self.api_url = "https://api-inference.huggingface.co/models/ai4bharat/indic-conformer-110m-multilingual"
        
    def transcribe(self, audio_data: bytes) -> Optional[str]:
        if not self.api_key:
            print("ERROR: HUGGINGFACE_API_KEY not set for STT.")
            return None
            
        headers = {"Authorization": f"Bearer {self.api_key}"}
        
        try:
            print(f"[STT] Sending {len(audio_data)} bytes to HuggingFace API...")
            response = requests.post(self.api_url, headers=headers, data=audio_data, timeout=30)
            
            print(f"[STT] Response status: {response.status_code}")
            
            if response.status_code != 200:
                print(f"[STT] API Error Response: {response.text}")
                return None
            
            result = response.json()
            print(f"[STT] API Response: {result}")
            
            if isinstance(result, dict) and 'text' in result:
                return result['text']
            elif isinstance(result, dict) and 'error' in result:
                print(f"STT API Error: {result['error']}")
                return None
            else:
                print(f"[STT] Unexpected response format: {result}")
                return None
        except requests.exceptions.Timeout:
            print("[STT] Request timeout - model might be loading")
            return None
        except Exception as e:
            print(f"STT Error: {e}")
            import traceback
            traceback.print_exc()
            return None

# Singleton instance
stt_service = STTService()
