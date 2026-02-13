from flask import Blueprint, request, jsonify, abort
import base64
import os
from typing import Optional, List, Dict, Any
from app.services.gemini_service import GeminiService
from app.services.audio_service import AudioService
from app.database import SessionLocal
from app.models import User, ChatHistory
from app.auth import decode_access_token

# Initialize services
gemini_service = GeminiService()
audio_service = AudioService()

router = Blueprint('chat', __name__)

def detect_language(text: str, default: str = 'en') -> str:
    """Simple script-based language detection for Indian languages"""
    if any('\u0900' <= c <= '\u097F' for c in text): return 'hi'  # Hindi
    elif any('\u0C00' <= c <= '\u0C7F' for c in text): return 'te'  # Telugu
    elif any('\u0980' <= c <= '\u09FF' for c in text): return 'bn'  # Bengali
    elif any('\u0800' <= c <= '\u0BFF' for c in text): return 'ta'  # Tamil
    elif any('\u0C80' <= c <= '\u0CFF' for c in text): return 'kn'  # Kannada
    elif any('\u0D00' <= c <= '\u0D7F' for c in text): return 'ml'  # Malayalam
    elif any('\u0A80' <= c <= '\u0AFF' for c in text): return 'gu'  # Gujarati
    return default

@router.route('/', methods=['POST'], strict_slashes=False)
def chat_endpoint():
    """
    Main chat endpoint supporting both text and voice input.
    Pipeline: Audio -> STT -> Translate -> Gemini -> Translate -> TTS
    """
    # Handle both JSON (from frontend text) and Multipart (potentially for audio)
    if request.is_json:
        data = request.json
        message = data.get('message')
        # ... rest of the file ...
        language = data.get('language', 'en')
        voice_enabled = data.get('voice_enabled', False)
        context = data.get('context', 'general')
        audio = None
    else:
        message = request.form.get('message')
        language = request.form.get('language', 'en')
        # Convert string 'true'/'false' to boolean if it comes from form data
        voice_enabled = request.form.get('voice_enabled') == 'true' or request.form.get('voice_enabled') == True
        context = request.form.get('context', 'general')
        audio = request.files.get('audio')

    # Auth Check: Get User ID
    user_id = None
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith("Bearer "):
        try:
            token = auth_header.split(" ")[1]
            payload = decode_access_token(token)
            if payload:
                username = payload.get("sub")
                db = SessionLocal()
                user = db.query(User).filter(User.username == username).first()
                if user:
                    user_id = user.id
                db.close()
        except Exception as e:
            print(f"[AUTH ERROR] {e}")

    user_message = message
    
    # Language Mapping
    LANGUAGE_NAMES = {
        'en': 'English',
        'hi': 'Hindi',
        'bn': 'Bengali',
        'te': 'Telugu',
        'mr': 'Marathi',
        'ta': 'Tamil',
        'gu': 'Gujarati',
        'kn': 'Kannada',
        'ml': 'Malayalam'
    }

    # Step 2: Determine Output Language (EARLY)
    # STRICTLY use the requested language if provided.
    if language:
        target_lang = language
    else:
        # This 'detected_lang' variable is not defined here if 'language' is not provided.
        # It will be defined later in the text flow.
        # For now, setting a default or ensuring it's handled in the text flow.
        # A more robust solution might involve detecting language from user_message here if language is None.
        target_lang = 'en' # Default to English if not explicitly set and not detected yet.
        
    target_lang_name = LANGUAGE_NAMES.get(target_lang, 'English')
    
    use_search_flag = False

    # Market Labels Localization
    MARKET_LABELS = {
        'en': {'today': "Today's Rate", 'yesterday': "Yesterday's Rate", 'trend': "Trend"},
        'hi': {'today': "आज का भाव", 'yesterday': "कल का भाव", 'trend': "बाज़ार का रुझान"},
        'ta': {'today': "இன்றைய விலை", 'yesterday': "நேற்றைய விலை", 'trend': "சந்தை போக்கு"},
        'te': {'today': "ఈరోజు ధర", 'yesterday': "నిన్నటి ధర", 'trend': "ధరల సరళి"},
        'kn': {'today': "ಇಂದಿನ ದರ", 'yesterday': "ನಿನ್ನೆಯ ದರ", 'trend': "ದರ ಏರಿಳಿತ"},
        'ml': {'today': "ഇന്നത്തെ വില", 'yesterday': "ഇന്നലത്തെ വില", 'trend': "വിപണി പ്രവണത"},
        'bn': {'today': "আজকের দর", 'yesterday': "গতকালের দর", 'trend': "বাজারের প্রবণতা"},
        'mr': {'today': "आजचा भाव", 'yesterday': "कालचा भाव", 'trend': "बाजार भाव"},
        'gu': {'today': "આજના ભાવ", 'yesterday': "ગઈકાલના ભાવ", 'trend': "બજાર વલણ"}
    }
    
    # Instruction for structured response (Summary + Details)
    if request.is_json and request.json.get('type') == 'market':
        use_search_flag = True
        
        # Get localized labels
        labels = MARKET_LABELS.get(target_lang, MARKET_LABELS['en'])
        
        structured_instruction = (
            f" Provide the answer IN {target_lang_name.upper()}. "
            "IMPORTANT: Use the Google Search tool to find the LATEST real-time market rates for the requested crop in India. "
            "Format the response EXACTLY as follows, with NO bolding (*), NO markdown, and NO extra text:\n"
            f"{labels['today']}: [Real rate found via search]\n"
            f"{labels['yesterday']}: [Real rate found via search or estimate]\n"
            f"{labels['trend']}: [Brief explanation based on search results]\n"
            "||| [Leave this part Key strictly empty as user will click more details for info]"
        )
    else:
        structured_instruction = (
            f" Provide the answer IN {target_lang_name.upper()} in two parts using a strict delimiter '|||'. "
            "Part 1: A concise 3-line summary. "
            "Part 2: Detailed explanation and more information if applicable. "
            "Structure: [Summary] ||| [Details]"
        )

    # Step 1: Logic Branch for Audio vs Text
    ai_response = ""
    
    if audio:
        audio_bytes = audio.read()
        # Pass structured_instruction as message to be included in system prompt for audio
        gemini_output = gemini_service.generate_response(message=structured_instruction, audio_data=audio_bytes, audio_mime_type='audio/ogg', context=context, use_search=use_search_flag)
        print(f"[GEMINI AUDIO] Raw output: {gemini_output[:100]}...")
        
        # Parse Output
        import re
        transcribed_match = re.search(r"Transcribed:\s*(.*?)(?:\nResponse:|$)", gemini_output, re.DOTALL)
        response_match = re.search(r"Response:\s*(.*)", gemini_output, re.DOTALL)
        
        if transcribed_match:
            user_message = transcribed_match.group(1).strip()
        else:
            user_message = "(Audio Input)"
            
        if response_match:
            ai_response = response_match.group(1).strip()
        else:
            # Fallback if format failed
            ai_response = gemini_output.replace(f"Transcribed: {user_message}", "").strip()

        print(f"[GEMINI AUDIO] Transcribed: {user_message}")
        print(f"[GEMINI AUDIO] Response: {ai_response}")
        
    elif user_message:
        # Text Flow
        if not language or language == 'en':
             detected_lang = detect_language(user_message, 'en')
        else:
             detected_lang = detect_language(user_message, language)
        
        # Translate input to English ONLY if detected language is different and target is English (or just always for good understanding)
        # But for direct generation, we can feed localized query to Gemini. 
        # However, translating to English usually gives better reasoning.
        if detected_lang != 'en':
            english_query = audio_service.translate_text(user_message, 'en')
            print(f"[TRANSLATE] {detected_lang}->en: {english_query}")
        else:
            english_query = user_message
            
        final_query = english_query + "\n\n" + structured_instruction
        ai_response = gemini_service.generate_response(final_query, context=context, use_search=use_search_flag)
        print(f"[GEMINI TEXT] {ai_response[:100]}...")
        
    else:
        return jsonify({"error": "No message or audio provided"}), 400

    # Step 3: Translation Skipped (Gemini handles it via instruction)
    final_response = ai_response
    
    # Update detected_lang for frontend sync
    # Ensure detected_lang is always set, especially if 'language' was provided and no audio.
    if 'detected_lang' not in locals():
        detected_lang = target_lang
    
    # Step 6: Generate speech if voice enabled
    audio_url = None
    if voice_enabled:
        # Clean text for TTS (remove markdown * # - etc)
        import re
        clean_text = re.sub(r'[*#_`~-]', '', final_response)
        audio_bytes = audio_service.text_to_speech(clean_text, detected_lang)
        if audio_bytes:
            audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
            audio_url = f"data:audio/mp3;base64,{audio_base64}"
            print(f"[TTS] Generated audio ({len(audio_bytes)} bytes)")
    
    # Save to DB
    if user_id:
        try:
            db = SessionLocal()
            db.add(ChatHistory(user_id=user_id, message=user_message, sender="user"))
            db.add(ChatHistory(user_id=user_id, message=final_response, sender="ai"))
            db.commit()
            db.close()
        except Exception as e:
            print(f"[DB ERROR] Could not save chat history: {e}")
    
    return jsonify({
        "response_text": final_response,
        "user_text": user_message,
        "audio_url": audio_url,
        "detected_language": detected_lang
    })

@router.route('/history', methods=['GET'])
def get_chat_history():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith("Bearer "):
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        token = auth_header.split(" ")[1]
        payload = decode_access_token(token)
        if not payload:
            return jsonify({"error": "Invalid token"}), 401
            
        username = payload.get("sub")
        db = SessionLocal()
        user = db.query(User).filter(User.username == username).first()
        
        if not user:
            db.close()
            return jsonify({"error": "User not found"}), 404
            
        history = db.query(ChatHistory).filter(ChatHistory.user_id == user.id).order_by(ChatHistory.timestamp).all()
        
        messages = []
        for msg in history:
            messages.append({
                "id": str(msg.id),
                "text": msg.message,
                "sender": msg.sender,
                "timestamp": msg.timestamp.isoformat()
            })
            
        db.close()
        return jsonify(messages)
        
    except Exception as e:
        print(f"[HISTORY ERROR] {e}")
        return jsonify({"error": "Failed to fetch history"}), 500

@router.route('/history', methods=['DELETE'])
def delete_all_history():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith("Bearer "):
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        token = auth_header.split(" ")[1]
        payload = decode_access_token(token)
        if not payload:
            return jsonify({"error": "Invalid token"}), 401
            
        username = payload.get("sub")
        db = SessionLocal()
        user = db.query(User).filter(User.username == username).first()
        
        if not user:
            db.close()
            return jsonify({"error": "User not found"}), 404
            
        # Delete all history for this user
        db.query(ChatHistory).filter(ChatHistory.user_id == user.id).delete()
        db.commit()
        db.close()
        return jsonify({"message": "History deleted successfully"})
        
    except Exception as e:
        print(f"[HISTORY DELETE ERROR] {e}")
        return jsonify({"error": "Failed to delete history"}), 500

@router.route('/history/<int:msg_id>', methods=['DELETE'])
def delete_message(msg_id):
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith("Bearer "):
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        token = auth_header.split(" ")[1]
        payload = decode_access_token(token)
        if not payload:
            return jsonify({"error": "Invalid token"}), 401
            
        username = payload.get("sub")
        db = SessionLocal()
        user = db.query(User).filter(User.username == username).first()
        
        if not user:
            db.close()
            return jsonify({"error": "User not found"}), 404
            
        # Delete specific message
        msg = db.query(ChatHistory).filter(ChatHistory.id == msg_id, ChatHistory.user_id == user.id).first()
        if msg:
            db.delete(msg)
            db.commit()
        
        db.close()
        return jsonify({"message": "Message deleted"})
        
    except Exception as e:
        print(f"[MESSAGE DELETE ERROR] {e}")
        return jsonify({"error": "Failed to delete message"}), 500
@router.route('/tts', methods=['POST'])
def generate_tts():
    """
    Generate TTS audio for a given text.
    """
    data = request.json
    text = data.get('text')
    language = data.get('language', 'en')
    
    if not text:
        return jsonify({"error": "No text provided"}), 400
        
    # Clean text for TTS
    import re
    clean_text = re.sub(r'[*#_`~-]', '', text)
    
    try:
        audio_bytes = audio_service.text_to_speech(clean_text, language)
        if audio_bytes:
            audio_base64 = base64.b64encode(audio_bytes).decode('utf-8')
            audio_url = f"data:audio/mp3;base64,{audio_base64}"
            return jsonify({"audio_url": audio_url})
    except Exception as e:
        return jsonify({"error": f"TTS Failure: {str(e)}"}), 500
    
    return jsonify({"error": "Failed to generate audio (Unknown)"}), 500


@router.route('/settings/env', methods=['POST'])
def update_env_settings():
    """
    Update .env file with provided settings.
    """
    data = request.json
    gemini_key = data.get('GEMINI_API_KEY')
    hf_key = data.get('HUGGINGFACE_API_KEY')
    
    if not gemini_key and not hf_key:
        return jsonify({"message": "No keys provided to update"}), 200
        
    env_path = '.env'
    
    # Read existing env
    env_lines = []
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            env_lines = f.readlines()
            
    new_lines = []
    keys_updated = set()
    
    for line in env_lines:
        if line.startswith('GEMINI_API_KEY=') and gemini_key:
            new_lines.append(f'GEMINI_API_KEY={gemini_key}\n')
            keys_updated.add('GEMINI_API_KEY')
        elif line.startswith('HUGGINGFACE_API_KEY=') and hf_key:
            new_lines.append(f'HUGGINGFACE_API_KEY={hf_key}\n')
            keys_updated.add('HUGGINGFACE_API_KEY')
        else:
            new_lines.append(line)
            
    if gemini_key and 'GEMINI_API_KEY' not in keys_updated:
        if new_lines and not new_lines[-1].endswith('\n'):
            new_lines.append('\n')
        new_lines.append(f'GEMINI_API_KEY={gemini_key}\n')
        
    if hf_key and 'HUGGINGFACE_API_KEY' not in keys_updated:
        if new_lines and not new_lines[-1].endswith('\n'):
            new_lines.append('\n')
        new_lines.append(f'HUGGINGFACE_API_KEY={hf_key}\n')
        
    try:
        with open(env_path, 'w') as f:
            f.writelines(new_lines)
        
        # Reload env in current process
        from dotenv import load_dotenv
        load_dotenv(override=True)
            
        return jsonify({"message": "Settings updated successfully"})
    except Exception as e:
        print(f"[ENV UPDATE ERROR] {e}")
        return jsonify({"error": "Failed to update settings"}), 500

@router.route('/generate', methods=['POST'])
def generate_content():
    """
    Generic endpoint to generate structured content via Gemini.
    Used for Marketing blogs, Schemes, Vehicle details, etc.
    """
    data = request.json
    topic = data.get('topic')
    type_ = data.get('type') # 'marketing', 'schemes', 'vehicles'
    language = data.get('language', 'en')
    
    if not topic or not type_:
        return jsonify({"error": "Missing topic or type"}), 400
        
    prompt = ""
    if type_ == 'marketing':
        prompt = f"Generate 3 real-world success stories about {topic} in India. Format as JSON with fields: name, location, content (summary of success), image_prompt (description for image generation). Language: {language}."
    elif type_ == 'schemes':
        prompt = f"List 3 real government schemes for {topic} in India. Format as JSON with fields: name, details, eligibility, application_link (real or placeholder), youtube_link (real or placeholder). Language: {language}."
    elif type_ == 'vehicles':
         prompt = f"List 3 popular agricultural vehicles for {topic} in India with real-time approximate prices. Format as JSON with fields: name, type, price, purpose, image_prompt. Language: {language}."
    
    # helper to get json from gemini
    try:
        response = gemini_service.generate_response(prompt, context='general')
        # Clean markdown json
        import re
        import json
        json_match = re.search(r'\{.*\}|\[.*\]', response, re.DOTALL)
        if json_match:
            return jsonify(json.loads(json_match.group(0)))
        else:
            return jsonify({"error": "Failed to parse generation", "raw": response}), 500
    except Exception as e:
        print(f"[GENERATE ERROR] {e}")
        return jsonify({"error": str(e)}), 500
