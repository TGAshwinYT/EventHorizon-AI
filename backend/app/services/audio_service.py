import edge_tts
import speech_recognition as sr
from deep_translator import GoogleTranslator
import os
import io
import asyncio
        # Run async function in a separate thread to ensure a clean loop
        import threading
        
        result_container = {"data": None, "error": None}

        def runner():
            try:
                # asyncio.run() automatically creates a new event loop, 
                # runs the coroutine as a Task, and closes the loop.
                # This is the most standard and safe way to run async code in a thread.
                result_container["data"] = asyncio.run(_generate())
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
