import asyncio
import logging
import os
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO)
from app.services.riva_tts_service import riva_tts_service

async def test():
    print("Synthesizing audio...")
    audio = await riva_tts_service.synthesize("Hello! This is a test of the new TTS pipeline.", language="en")
    if audio:
        print(f"Success! Got {len(audio)} bytes of audio.")
        with open("test_output.mp3", "wb") as f:
            f.write(audio)
    else:
        print("Failed to generate audio.")

if __name__ == "__main__":
    asyncio.run(test())
