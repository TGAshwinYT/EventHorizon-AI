import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

class GroqService:
    def __init__(self):
        if GROQ_API_KEY:
            self.client = Groq(api_key=GROQ_API_KEY.strip())
            print("[GROQ ASR] Service Initialized (Model: whisper-large-v3).")
        else:
            self.client = None
            print("[GROQ ASR] Warning: GROQ_API_KEY not found. Running in mock mode.")

    def transcribe_audio(self, audio_bytes: bytes, filename: str = "audio.webm") -> dict:
        """
        Transcribe voice audio bytes to text using Groq Whisper API.
        """
        if not self.client:
            return {
                "transcript": "வணக்கம் நண்பா, எப்படி இருக்கீங்க? (Mock translation Tamil)",
                "language_detected": "ta"
            }

        try:
            # Send audio bytes directly to Groq Whisper (in-memory, no disk I/O)
            transcription = self.client.audio.transcriptions.create(
                file=(filename, audio_bytes),
                model="whisper-large-v3",
                response_format="verbose_json"
            )

            transcript = transcription.text
            # Fetch detected language (or fallback to 'en')
            language = getattr(transcription, "language", "en")
            
            print(f"[GROQ ASR] Successful transcription: {transcript[:100]}... [Language: {language}]")
            return {
                "transcript": transcript,
                "language_detected": language
            }

        except Exception as e:
            print(f"[GROQ ASR ERROR] Transcription failed: {e}")
            return {
                "transcript": "",
                "language_detected": "en",
                "error": str(e)
            }

groq_service = GroqService()
