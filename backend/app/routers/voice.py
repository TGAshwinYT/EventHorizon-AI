from flask import Blueprint, request, jsonify
import base64
from app.services.audio_service import AudioService

# Initialize service
audio_service = AudioService()

router = Blueprint('voice', __name__)

@router.route("/transcribe", methods=['POST'])
def transcribe_audio():
    """Convert speech audio to text"""
    if 'audio' not in request.files:
         return jsonify({"error": "No audio file provided"}), 400
         
    audio = request.files['audio']
    language = request.form.get('language', 'hi')
    
    audio_bytes = audio.read()
    transcribed_text = audio_service.speech_to_text(audio_bytes, f"{language}-IN")
    
    if transcribed_text:
        return jsonify({"text": transcribed_text, "language": language})
    else:
        return jsonify({"error": "Transcription failed"}), 422

@router.route("/synthesize", methods=['POST'])
def synthesize_speech():
    """Convert text to speech audio"""
    data = request.json
    if not data or 'text' not in data:
        return jsonify({"error": "No text provided"}), 400
        
    text = data.get('text')
    language = data.get('language', 'hi')
    
    audio_bytes = audio_service.text_to_speech(text, language)
    
    if audio_bytes:
        audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
        return jsonify({
            "audio_base64": audio_base64,
            "format": "mp3",
            "language": language
        })
    else:
        return jsonify({"error": "Speech synthesis failed"}), 422

@router.route("/translate", methods=['POST'])
def translate_text():
    """Translate text between languages"""
    data = request.json
    if not data:
         return jsonify({"error": "No data provided"}), 400
         
    text = data.get('text')
    source_language = data.get('source_language')
    target_language = data.get('target_language')
    
    if not all([text, source_language, target_language]):
         return jsonify({"error": "Missing required fields"}), 400
         
    translated_text = audio_service.translate_text(text, target_language)
    
    return jsonify({
        "original_text": text,
        "translated_text": translated_text,
        "source_language": source_language,
        "target_language": target_language
    })
