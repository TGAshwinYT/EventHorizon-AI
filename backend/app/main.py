import os
import sys
import asyncio
from dotenv import load_dotenv

load_dotenv(override=True)
print(f"DEBUG MAIN: DATABASE_URL={os.getenv('DATABASE_URL')}")

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from app.routers import chat, market, voice, auth
from app.database import engine, Base

app = Flask(__name__)
CORS(app)

# Create database tables
Base.metadata.create_all(bind=engine)

# Create audio output directory
AUDIO_DIR = os.path.join(os.getcwd(), "audio_output")
os.makedirs(AUDIO_DIR, exist_ok=True)

# Register Blueprints
app.register_blueprint(chat.router, url_prefix='/api/chat')
app.register_blueprint(market.router, url_prefix='/api/market')
app.register_blueprint(voice.router, url_prefix='/api/voice')
app.register_blueprint(auth.router, url_prefix='/api/auth')

@app.route('/')
def root():
    return jsonify({"message": "EventHorizon AI Backend (Flask + AWS) is running"})

# Serve audio files
@app.route('/audio/<path:filename>')
def serve_audio(filename):
    return send_from_directory(AUDIO_DIR, filename)

@app.route('/api/debug', methods=['GET'])
def debug_endpoint():
    db_status = "unknown"
    try:
        from app.database import SessionLocal
        from sqlalchemy import text
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        db_status = "Connected"
    except Exception as e:
        db_status = f"Failed: {str(e)}"

    modules_status = {}
    try:
        import edge_tts
        modules_status["edge_tts"] = "Installed"
    except ImportError:
        modules_status["edge_tts"] = "Missing"

    status = {
        "database": db_status,
        "env_vars": {
            "DATABASE_URL": "Set" if os.getenv("DATABASE_URL") else "Missing",
            "GEMINI_API_KEY": "Set" if os.getenv("GEMINI_API_KEY") else "Missing"
        },
        "modules": modules_status
    }
    return jsonify(status)

@app.errorhandler(Exception)
def handle_exception(e):
    from werkzeug.exceptions import HTTPException
    if isinstance(e, HTTPException):
        return e
    
    # Log to server console
    import traceback
    traceback.print_exc()
    
    return jsonify({
        "error": "Internal Server Error",
        "details": str(e),
        "type": type(e).__name__
    }), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000, debug=True)

