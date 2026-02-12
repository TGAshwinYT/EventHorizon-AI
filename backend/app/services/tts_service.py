import os
import asyncio
import edge_tts
import uuid
from typing import Optional

# Mapping project language codes to Edge-TTS voice names
# Verified voice names for Indian languages
VOICE_MAP = {
    'en': 'en-IN-PrabhatNeural',
    'hi': 'hi-IN-MadhurNeural',
    'bn': 'bn-IN-BashkarNeural',
    'te': 'te-IN-MohanNeural',
    'mr': 'mr-IN-ManoharNeural',
    'ta': 'ta-IN-ValluvarNeural',
    'ur': 'ur-IN-GulNeural',
    'gu': 'gu-IN-DhwaniNeural',
    'kn': 'kn-IN-GaganNeural',
    'ml': 'ml-IN-MidhunNeural',
    'pa': 'pa-IN-GurdeepNeural'
}

class TTSService:
    def __init__(self, output_dir: str = "backend/app/static/audio"):
        self.output_dir = output_dir
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

    async def generate_speech(self, text: str, lang_code: str) -> Optional[str]:
        """
        Generates an MP3 file for the given text and language.
        Returns the full URL (with server address) for playback.
        """
        voice = VOICE_MAP.get(lang_code, VOICE_MAP['en'])
        filename = f"{uuid.uuid4()}.mp3"
        filepath = os.path.join(self.output_dir, filename)
        
        try:
            communicate = edge_tts.Communicate(text, voice)
            await communicate.save(filepath)
            # Return full URL with server address
            return f"http://localhost:8000/static/audio/{filename}"
        except Exception as e:
            print(f"TTS Error: {e}")
            return None

# Singleton instance
tts_service = TTSService()
