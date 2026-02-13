import edge_tts
import speech_recognition as sr
from deep_translator import GoogleTranslator
import os
import io
import asyncio
import nest_asyncio
from typing import Optional, cast, Dict, Any

# Apply nest_asyncio to allow async execution in Flask
nest_asyncio.apply()

class AudioService:
    def __init__(self):
        self.recognizer = sr.Recognizer()
        # Default voices
        self.voices = {
            'en': 'en-IN-NeerjaNeural',
            'hi': 'hi-IN-SwaraNeural',
            'te': 'te-IN-MohanNeural',
            'ta': 'ta-IN-PallaviNeural',
            'mr': 'mr-IN-AarohiNeural',
            'gu': 'gu-IN-DhwaniNeural',
            'kn': 'kn-IN-GaganNeural',
            'ml': 'ml-IN-MidhunNeural'
        }

    def text_to_speech(self, text: str, lang: str = 'en') -> Optional[bytes]:
        """Convert text to speech using Edge-TTS (High Quality)"""
        # Removed broad try-except to allow debugging 500 errors in router
        voice = self.voices.get(lang, 'en-US-AriaNeural')
        
        async def _generate() -> bytes:
            communicate = edge_tts.Communicate(text, voice)
            audio_data = bytearray()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    data = cast(bytes, chunk["data"])
                    audio_data.extend(data)
            return bytes(audio_data)

        # Run async function in a separate thread to ensure a clean loop
        import threading
        
        result_container = {"data": None, "error": None}

        def runner():
            try:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                # Explicitly wrap in a Task to satisfy stricter aiohttp/async-timeout requirements
                task = loop.create_task(_generate())
                result_container["data"] = loop.run_until_complete(task)
                # Clean shutdown of generators if any
                loop.run_until_complete(loop.shutdown_asyncgens())
                loop.close()
            except Exception as e:
                result_container["error"] = e

        thread = threading.Thread(target=runner)
        thread.start()
        thread.join()

        if result_container["error"]:
            raise result_container["error"]
            
        return cast(bytes, result_container["data"])

    def speech_to_text(self, audio_bytes: bytes, lang: str = 'en-IN') -> Optional[str]:
        """Convert speech to text using SpeechRecognition"""
        try:
            # Note: SpeechRecognition usually needs a file path or AudioData
            # For this simplified implementation, we'd need to save bytes to a temp wav file
            # or use pydub to convert to wav if it's not already.
            # Assuming input is wav for now or skipping complex conversion implementation
            # to focus on the TTS request. 
            # Real implementation would use:
            # with sr.AudioFile(temp_filename) as source:
            #     audio = self.recognizer.record(source)
            #     return self.recognizer.recognize_google(audio, language=lang)
            return "" 
        except Exception as e:
            print(f"[STT ERROR] {e}")
            return None

    def translate_text(self, text: str, target_lang: str) -> str:
        """Translate text using deep_translator"""
        try:
            return GoogleTranslator(source='auto', target=target_lang).translate(text)
        except Exception as e:
            print(f"[TRANSLATE ERROR] {e}")
            return text

audio_service = AudioService()
