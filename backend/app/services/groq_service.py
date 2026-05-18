import os
import tempfile
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

        # Determine temp file suffix
        suffix = os.path.splitext(filename)[1] or ".webm"
        temp_path = None
        
        try:
            # Write audio bytes to a temp file
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temp_file:
                temp_file.write(audio_bytes)
                temp_path = temp_file.name

            # Send file to Groq Whisper
            with open(temp_path, "rb") as file_to_transcribe:
                transcription = self.client.audio.transcriptions.create(
                    file=(filename, file_to_transcribe.read()),
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
        finally:
            # Ensure cleanup of temp file
            if temp_path and os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except Exception:
                    pass

groq_service = GroqService()
