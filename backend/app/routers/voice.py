from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import base64
from typing import Optional
from app.services.audio_service import AudioService

# Initialize service
audio_service = AudioService()

router = APIRouter()

class SynthesizeRequest(BaseModel):
    text: str
    language: str = 'hi'

class TranslateRequest(BaseModel):
    text: str
    source_language: str
    target_language: str

@router.post("/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    language: str = Form('hi')
):
    """Convert speech audio to text"""
    if not audio:
         raise HTTPException(status_code=400, detail="No audio file provided")
         
    audio_bytes = await audio.read()
    transcribed_text = audio_service.speech_to_text(audio_bytes, f"{language}-IN")
    
    if transcribed_text:
        return {"text": transcribed_text, "language": language}
    else:
        raise HTTPException(status_code=422, detail="Transcription failed")

@router.post("/synthesize")
def synthesize_speech(data: SynthesizeRequest):
    """Convert text to speech audio"""
    text = data.text
    language = data.language
    
    audio_bytes = audio_service.text_to_speech(text, language)
    
    if audio_bytes:
        audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
        return {
            "audio_base64": audio_base64,
            "format": "mp3",
            "language": language
        }
    else:
         raise HTTPException(status_code=422, detail="Speech synthesis failed")

@router.post("/translate")
def translate_text(data: TranslateRequest):
    """Translate text between languages"""
    text = data.text
    target_language = data.target_language
    source_language = data.source_language
    
    # Validation handled by Pydantic
         
    translated_text = audio_service.translate_text(text, target_language)
    
    return {
        "original_text": text,
        "translated_text": translated_text,
        "source_language": source_language,
        "target_language": target_language
    }
