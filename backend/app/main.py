import os
import sys
import asyncio
from dotenv import load_dotenv

load_dotenv(override=True)
print(f"DEBUG MAIN: AUTH_DATABASE_URL={os.getenv('AUTH_DATABASE_URL')}")
print(f"DEBUG MAIN: MANDI_DATABASE_URL={os.getenv('MANDI_DATABASE_URL')}")

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.routers import chat, market, voice, auth, weather
from app.database import auth_engine, mandi_engine, AuthBase, MandiBase

# Database initialization is moved to startup event for better resilience

# Create audio output directory
AUDIO_DIR = os.path.join(os.getcwd(), "audio_output")
os.makedirs(AUDIO_DIR, exist_ok=True)

# Initialize Databases with timeout/error handling
# We use a separate thread/task for this to avoid blocking the main event loop
def init_db():
    from app.database import auth_engine, mandi_engine, AuthBase, MandiBase, debug_print
    try:
        debug_print("Attempting to create tables for AUTH database...")
        AuthBase.metadata.create_all(bind=auth_engine)
        debug_print("AUTH database tables initialized.")
        
        debug_print("Attempting to create tables for MANDI database...")
        MandiBase.metadata.create_all(bind=mandi_engine)
        debug_print("MANDI database tables initialized.")
    except Exception as e:
        debug_print(f"CRITICAL: Database initialization failed: {e}")
        # We don't raise here so the API can still start (for health checks/debugging)

app = FastAPI(title="EventHorizon AI Backend")

@app.on_event("startup")
async def startup_event():
    # Start Scheduler
    from app.services.scheduler import start_scheduler
    start_scheduler()
    
    # Run in the background to avoid blocking startup if DB is slow/hanging
    asyncio.create_task(asyncio.to_thread(init_db))

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

@app.get('/')
async def root():
    return {"message": "EventHorizon AI Backend (FastAPI + AWS) is running"}

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
