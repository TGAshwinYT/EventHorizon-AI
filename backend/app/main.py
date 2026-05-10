import os
import sys
import asyncio
from dotenv import load_dotenv

load_dotenv(override=True)
print(f"DEBUG MAIN: AUTH_DATABASE_URL={os.getenv('AUTH_DATABASE_URL')}")
print(f"DEBUG MAIN: MANDI_DATABASE_URL={os.getenv('MANDI_DATABASE_URL')}")

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.routers import chat, market, voice, auth, weather, voice_pipeline, scanner
from app.database import auth_engine, mandi_engine, AuthBase, MandiBase

ml_models = {}

# Database initialization is moved to startup event for better resilience

# Create audio output directory
AUDIO_DIR = os.path.join(os.getcwd(), "audio_output")
os.makedirs(AUDIO_DIR, exist_ok=True)

# Initialize Databases with timeout/error handling
# We use a separate thread/task for this to avoid blocking the main event loop
def init_db():
    try:
        # We import here to ensure engines are created when needed
        from app.database import auth_engine, mandi_engine, AuthBase, MandiBase, debug_print
        
        debug_print("STARTING DB INITIALIZATION...")
        
        debug_print("Attempting to create tables for AUTH database...")
        AuthBase.metadata.create_all(bind=auth_engine)
        debug_print("AUTH database tables initialized/verified.")
        
        debug_print("Attempting to create tables for MANDI database...")
        MandiBase.metadata.create_all(bind=mandi_engine)
        debug_print("MANDI database tables initialized/verified.")
        
        debug_print("DB INITIALIZATION COMPLETED SUCCESSFULLY.")
    except Exception as e:
        from app.database import debug_print
        debug_print(f"CRITICAL: Database initialization failed: {e}")
        import traceback
        debug_print(traceback.format_exc())
        # We don't raise here so the API can still start (for health checks/debugging)

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("APPLICATION STARTING UP...")
    app.state.is_ready = False
    
    # Whisper is now lazy-loaded by riva_asr_service (Tier 3 fallback)
    # Only pre-load if no NVIDIA/Groq API keys are configured
    nvidia_key = os.getenv("NVIDIA_API_KEY", "")
    groq_key = os.getenv("GROQ_API_KEY", "")
    if not nvidia_key and not groq_key:
        print("[-] No cloud ASR keys found. Pre-loading local Whisper-tiny...")
        try:
            import whisper
            ml_models["whisper_tiny"] = whisper.load_model("tiny")
        except ImportError:
            print("[!] openai-whisper not installed. Local Whisper fallback unavailable.")
    else:
        print("[-] Cloud ASR available. Skipping Whisper pre-load (lazy fallback).")
    
    # Log NVIDIA NIM status
    if nvidia_key:
        print(f"[*] NVIDIA NIM: ENABLED (key: {nvidia_key[:12]}...)")
    else:
        print("[!] NVIDIA NIM: DISABLED (set NVIDIA_API_KEY in .env for Riva ASR/TTS)")
    
    # 1. Start Scheduler
    from app.services.scheduler import start_scheduler
    try:
        start_scheduler()
        print("[-] Scheduler started.")
    except Exception as e:
        print(f"[!] Failed to start scheduler: {e}")
        
    # 2. Database Initialization
    async def delayed_init():
        await asyncio.sleep(1) # Yield control
        init_db()
    asyncio.create_task(delayed_init())
    
    # 3. Simulate AI Model Warmup / Neural Link Building
    print("[-] Warming up AI models and establishing neural links...")
    await asyncio.sleep(2.5) 
    
    app.state.is_ready = True
    print("[*] Application startup complete. EventHorizon is Online.")
    
    yield

    # Teardown logic here
    print("APPLICATION SHUTTING DOWN...")
    
    # Shutdown Scheduler
    try:
        from app.services.scheduler import shutdown_scheduler
        shutdown_scheduler()
        print("[-] Scheduler shut down.")
    except Exception as e:
        print(f"[!] Failed to shut down scheduler: {e}")
        
    ml_models.clear()

app = FastAPI(title="EventHorizon AI Backend", lifespan=lifespan)

app.add_middleware(

    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(chat.router, prefix='/api/chat', tags=["Chat"])
app.include_router(market.router, prefix='/api/market', tags=["Market"])
app.include_router(voice.router, prefix='/api/voice', tags=["Voice"])
app.include_router(auth.router, prefix='/api/auth', tags=["Auth"])
app.include_router(weather.router, prefix='/api/weather', tags=["Weather"])
# Real-time voice pipeline (WebSocket ASR -> LLM -> TTS)
app.include_router(voice_pipeline.router, tags=["Voice Pipeline"])
# Visual Diagnostic Scanner (crop disease diagnosis from images)
app.include_router(scanner.router, prefix='/api/scanner', tags=["Scanner"])

@app.get('/')
async def root():
    return {"message": "EventHorizon AI Backend (FastAPI + AWS) is running"}

@app.get('/api/health')
async def health_check():
    if getattr(app.state, "is_ready", False):
        return {"status": "ready", "message": "EventHorizon API is online"}
    else:
        raise HTTPException(status_code=503, detail="booting")

# Serve audio files
# In FastAPI, we can mount a static directory.
# However, the original code used a route /audio/<filename>.
# We can reproduce that with a specific endpoint or mount static files.
# Mounting is easier and more efficient for serving files.
app.mount("/audio", StaticFiles(directory=AUDIO_DIR), name="audio")

@app.get('/api/debug')
async def debug_endpoint():
    db_status = "unknown"
    try:
        from app.database import AuthSessionLocal
        from sqlalchemy import text
        db = AuthSessionLocal()
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
            "AUTH_DATABASE_URL": "Set" if os.getenv("AUTH_DATABASE_URL") else "Missing",
            "MANDI_DATABASE_URL": "Set" if os.getenv("MANDI_DATABASE_URL") else "Missing",
            "GEMINI_API_KEY": "Set" if os.getenv("GEMINI_API_KEY") else "Missing"
        },
        "modules": modules_status
    }
    return status

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "details": str(exc),
            "type": type(exc).__name__
        }
    )

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
