import os
import tempfile
# Force transformers to use a shallow, explicit directory (cross-platform temporary directory)
temp_cache = os.path.join(tempfile.gettempdir(), "hf_cache")
os.environ["HF_HOME"] = temp_cache
os.environ["TRANSFORMERS_CACHE"] = temp_cache


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
from app.routers import market, auth, weather, scanner, harvestiq, satellite, assistant, research, schemes, mandi_prices, news, plant_scanner
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
    
    # 1. Start Scheduler
    from app.services.scheduler import start_scheduler
    try:
        start_scheduler()
        print("[-] Scheduler started.")
    except Exception as e:
        print(f"[!] Failed to start scheduler: {e}")
        
    # 2. Database Initialization (non-blocking)
    async def delayed_init():
        await asyncio.sleep(1) # Yield control
        await asyncio.to_thread(init_db)
    asyncio.create_task(delayed_init())
    
    # 3. Warm up Local Classifier Model in background to prevent startup blocking
    async def load_model_background():
        try:
            from transformers import AutoImageProcessor, AutoModelForImageClassification
            VISION_MODEL_NAME = "Abuzaid01/plant-disease-classifier"
            print("Loading pre-trained PlantVillage model in the background...")
            proc = await asyncio.to_thread(AutoImageProcessor.from_pretrained, VISION_MODEL_NAME)
            mod = await asyncio.to_thread(AutoModelForImageClassification.from_pretrained, VISION_MODEL_NAME)
            app.state.classifier_processor = proc
            app.state.classifier_model = mod
            print("Model loaded successfully in the background!")
        except Exception as e:
            print(f"[!] Failed to load local classifier model in background: {e}")
            
    asyncio.create_task(load_model_background())

    app.state.is_ready = True
    print("[*] Application startup complete. EventHorizon is Online.")
    
    yield

    # Teardown logic here
    print("APPLICATION SHUTTING DOWN...")
    
    # Clean up ML classifier models
    if hasattr(app.state, "classifier_processor"):
        del app.state.classifier_processor
    if hasattr(app.state, "classifier_model"):
        del app.state.classifier_model

    # Shutdown Scheduler
    try:
        from app.services.scheduler import shutdown_scheduler
        shutdown_scheduler()
        print("[-] Scheduler shut down.")
    except Exception as e:
        print(f"[!] Failed to shut down scheduler: {e}")
        
    # Shutdown Executor
    try:
        from app.services.executor_service import shutdown_executor
        shutdown_executor()
        print("[-] Process pool executor shut down.")
    except Exception as e:
        print(f"[!] Failed to shut down executor: {e}")
        
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
app.include_router(market.router, prefix='/api/market', tags=["Market"])
app.include_router(auth.router, prefix='/api/auth', tags=["Auth"])
app.include_router(weather.router, prefix='/api/weather', tags=["Weather"])
# Visual Diagnostic Scanner (crop disease diagnosis from images)
app.include_router(scanner.router, prefix='/api/scanner', tags=["Scanner"])
app.include_router(plant_scanner.router, prefix='/api/scanner', tags=["PlantScanner"])

# HarvestIQ — full agricultural risk REST API
app.include_router(harvestiq.router)
# Satellite NDVI — NASA MODIS vegetation health
app.include_router(satellite.router, prefix='/api/satellite', tags=["Satellite"])
# Assistant — Voice agricultural advisor
app.include_router(assistant.router, prefix='/api/assistant', tags=["Assistant"])
# Research — Agricultural & Product Research Engine
app.include_router(research.router, prefix='/api/assistant', tags=["Research"])
# Schemes — Dynamic AI-powered government schemes
app.include_router(schemes.router, prefix='/api/schemes', tags=["Schemes"])
# Mandi — Recent and Forecast mandi prices
app.include_router(mandi_prices.router, prefix='/api/mandi', tags=["Mandi"])
# News — Daily agricultural news
app.include_router(news.router, prefix='/api/news', tags=["News"])

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
