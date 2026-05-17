import os
import asyncio
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

async def test_tts():
    try:
        client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        print("Client initialized")
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents='Say "Hello, this is a test of the Gemini audio system." in a calm voice.',
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name="Aoede"
                        )
                    )
                )
            )
        )
        print("Response received")
        if response.text:
            print("Text:", response.text)
        
        # Audio is usually in inline_data
        has_audio = False
        for part in response.candidates[0].content.parts:
            if part.inline_data and part.inline_data.mime_type.startswith("audio"):
                print("Found audio!", len(part.inline_data.data), "bytes")
                with open("test_audio.wav", "wb") as f:
                    f.write(part.inline_data.data)
                has_audio = True
                
        if not has_audio:
            print("No audio found in response.", response)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(test_tts())
