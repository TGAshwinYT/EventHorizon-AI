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

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000, debug=True)
