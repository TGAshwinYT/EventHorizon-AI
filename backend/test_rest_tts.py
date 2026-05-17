import os
import requests
import base64
from dotenv import load_dotenv

load_dotenv()

key = os.getenv("GEMINI_API_KEY")
url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}"

payload = {
    "contents": [{"parts": [{"text": "Say 'hello from gemini text to speech' in a calm voice"}]}],
    "generationConfig": {
        "responseModalities": ["AUDIO"],
        "speechConfig": {
            "voiceConfig": {
                "prebuiltVoiceConfig": {
                    "voiceName": "Aoede"
                }
            }
        }
    }
}

res = requests.post(url, json=payload, headers={"Content-Type": "application/json"})
if res.status_code == 200:
    data = res.json()
    has_audio = False
    for part in data["candidates"][0]["content"]["parts"]:
        if "inlineData" in part and part["inlineData"]["mimeType"].startswith("audio"):
            print("Audio found!")
            audio_bytes = base64.b64decode(part["inlineData"]["data"])
            with open("test.mp3", "wb") as f:
                f.write(audio_bytes)
            has_audio = True
    if not has_audio:
        print("No audio found:", data)
else:
    print("Error:", res.status_code, res.text)
