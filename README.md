# 🌌 EventHorizon AI
> **A voice-first, multilingual, AI-powered agricultural advisor for rural India.**

EventHorizon AI brings state-of-the-art agricultural intelligence directly to Indian farmers through an intuitive, localized voice companion. Powered by advanced Large Language Models, real-time APMC Mandi rates, dynamic government schemes evaluation, satellite-based NDVI crop health analytics, and hyper-local risk warnings, EventHorizon is fully responsive and hand-tailored for both Desktop and Mobile experiences.

---

## 🚀 Quick Launch
To run both backend and frontend servers with automatic venv detection and browser opening:
```bash
python run.py
```

---

## 📋 Table of Contents
1. [🌟 Core Pillars & Feature Details](#-core-pillars--feature-details)
2. [🛠️ Technology Stack](#️-technology-stack)
3. [📊 System Flow & Architecture](#-system-flow--architecture)
4. [📂 Codebase Structure](#-codebase-structure)
5. [⚙️ Environment Configuration](#️-environment-configuration)
6. [🔧 Installation & Manual Setup](#-installation--manual-setup)
7. [🤝 API Endpoints Guide](#-api-endpoints-guide)

---

## 🌟 Core Pillars & Feature Details

### 🎙️ 1. Multilingual Voice Assistant ("Horizon")
* **High-Performance 2-Tier TTS**: 
  * **Primary**: Multimodal **Gemini 3.1 Flash TTS** (`gemini-3.1-flash-tts-preview`) generating warm, high-fidelity neural audio. Raw `audio/l16` PCM output is automatically wrapped into standard `RIFF WAV` headers on the fly.
  * **Fallback**: Native **Sarvam AI** (`bulbul:v3`) API for zero-cost, localized Indian dialect synthesis supporting Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati, and Punjabi.
* **Groq Whisper STT**: Ultra-low-latency transcription engine utilizing `whisper-large-v3` to process vocal queries from rural users.
* **Unified Wave Stream Delivery**: Speech synthesis is delivered directly via standard binary WAV byte stream APIs, completely bypassing inconsistent browser speech synthesis overlays and avoiding double token consumption.

### 🏛️ 2. Dynamic Government Schemes Explorer
* **Adaptive Fuzzy Search**: Uses a dynamic Levenshtein distance algorithm that adapts matching thresholds based on query length (exact matching for short terms, typo-tolerant bounds of `Math.max(1, Math.floor(q.length / 3))` for longer queries).
* **Whole-Card Interaction**: Fully polished collapsible cards with smooth CSS micro-animations, clickable toggle scopes, and strict event propagation safeguards so action buttons function perfectly.
* **✨ New Scheme Notifications**: Automatically marks newly launched programs (e.g., *Agri Infra Fund* launching on `2026-06-01`) with alert badges and notification flags.
* **AI Eligibility Wizard**: Interactive form validating land holding size, annual income, state, and category against agricultural guidelines.
* **YouTube Video Guides**: Generates optimized search queries directly pointing to native instruction videos, preventing dead links.

### 🔍 3. Dynamic SPA Page Context Analyzer
* **DFS DOM Context Sweep**: High-performance, depth-first DOM traversal that sweeps active page text up to 4000 characters, filtering layout noise and structural metadata.
* **SPA Title Synchronization**: Hook-based active-view listener that synchronizes navigation triggers (Mandi, Schemes, Visual Diagnostics, Settings) with `document.title` and manually dispatches native `popstate` browser events. 
* **Seamless Page Analytics**: Enables "Horizon" to instantly analyze what layout or sub-view the user is looking at on both mobile and desktop.

### 🏥 4. HarvestIQ Crop Diagnostics & Satellite NDVI
* **Satellite Crop Health Monitoring**: Directly pulls Sentinel-2 satellite imagery via Sentinel Hub API, calculating NDVI (Normalized Difference Vegetation Index) values to monitor photosynthesis levels.
* **Visual Scanner Remediation**: Multi-modal computer vision scanner that evaluates uploaded crop disease images, diagnosing issues and querying Tavily Search for real-time local chemical/organic treatment prices.
* **Disease & Pest Forecasters**: Predicts outbreak probabilities for localized crops based on weather patterns.

### 📊 5. Mandi Intelligence & Price Forecasting
* **Agmarknet API Mandi Rates**: Instantly queries live commodity prices across standard APMC market mandis nationwide.
* **AI-Powered Market Forecasting**: Integrates state-of-the-art prediction models (Prophet/Scikit-Learn) to map standard 7-day commodity price trends on fully interactive UI charts.

### 📱 6. Secure Offline SMS Alerting Pipeline
* **Zero-Exposure Encrypted Phone Storage**: Farmer phone numbers are cryptographically shielded in the database using a zero-dependency SHA-256 derived stream cipher with random 8-byte salts.
* **Session Asterisk Masking**: The backend automatically decrypts stored phone numbers and masks middle digits (e.g. `+91 ******3210`) before returning them to client browser sessions to prevent theft.
* **Custom Anti-Spam Cooldown Limits**: Prevents notification fatigue by checking a custom rate-limiting threshold (configurable directly in Settings from **1 to 7 days**, default 7 days) before dispatching any message.
* **Dual Dispatcher System**: Seamlessly integrates with the live **Twilio REST API** (supporting direct Sender Numbers or Messaging Service SIDs) with an automatic zero-cost developer **Local Sandbox fallback** that writes beautiful output logs in `backend/user_memory/sms_logs.txt`.

---

## 🛠️ Technology Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | React 18+ (TS) | Single Page Application framework with robust typing |
| **Styling** | Tailwind CSS / CSS | Modern Glassmorphism, tailored color palettes & micro-animations |
| **Backend** | FastAPI | High-performance Python ASGI framework |
| **Database** | SQLite / PostgreSQL | Dynamic user profile tracking and Mandi caching |
| **LLMs & Vision** | Gemini 1.5 Pro / Flash | Core reasoning, conversational logs, visual crop diagnostic scanner |
| **Voice Synthesis** | Gemini 3.1 Flash / Sarvam | Multimodal neural voice synthesis (Bulbul v3 fallback) |
| **Transcription** | Groq Whisper | `whisper-large-v3` ultra-fast Indian language transcribing |
| **Forecasting** | Prophet & Pandas | 7-day predictive curves for commodity pricing |
| **Earth Observation**| Sentinel Hub API | Dynamic NDVI index metrics for agricultural zones |
| **SMS Notification**| Twilio API / HTTP Fallback| Offline SMS alerts via Twilio Sender Numbers or Messaging Service SIDs |

---

## 📊 System Flow & Architecture

```mermaid
graph TD
    %% User Interfaces
    User([Farmer / User]) -->|Interaction| Desktop[Desktop React SPA]
    User -->|Interaction| Mobile[Mobile React SPA]

    %% Frontends to Backend Gateway
    Desktop -->|Vocal/Text Queries| API[FastAPI Backend Gateway]
    Mobile -->|Vocal/Text Queries| API

    %% Navigation state synchronization
    Desktop -.->|DFS context / title change / popstate| API
    Mobile -.->|DFS context / title change / popstate| API

    %% Backend Router Routing
    subgraph FastAPI Core Services
        API --> RouterAssistant[assistant.py]
        API --> RouterSchemes[schemes.py]
        API --> RouterMandi[mandi_prices.py]
        API --> RouterHarvest[harvestiq.py]
        API --> RouterWeather[weather.py]
    end

    %% Router to Services Mapping
    RouterAssistant -->|STT / TTS Pipeline| ServiceVoice{Voice Engine Router}
    RouterAssistant -->|DFS Text Analyzer| ServiceGemini[gemini_service.py]
    RouterSchemes -->|Fuzzy Search / AI Eligibility| ServiceGemini
    RouterMandi -->|Mandi Forecasting Models| ServiceProphet[Prophet / Pandas Forecasting]
    RouterHarvest -->|Geospatial Satellite NDVI| ServiceSentinel[sentinel_hub_service.py]
    RouterHarvest -->|Multimodal Image Diagnostics| ServiceVision[vision_diagnostic_service.py]

    %% Voice Engine fallbacks
    ServiceVoice -->|Primary STT| ServiceGroq[Groq Whisper API]
    ServiceVoice -->|Primary TTS| ServiceGeminiTTS[Gemini 3.1 Flash TTS Model]
    ServiceVoice -->|Voice Fallback| ServiceSarvam[Sarvam AI Bulbul:v3 API]

    %% Databases
    RouterAssistant -->|Session Storage| DB[(SQLite/Postgres AuthDB)]
    RouterMandi -->|Cached Agmarknet APMC| DB
```

---

## 📂 Codebase Structure

```
EventHorizon-AI/
├── backend/                       # FastAPI Python Backend
│   ├── app/
│   │   ├── models/                # SQLAlchemy database schema models
│   │   │   ├── __init__.py
│   │   │   └── schemas.py         # Request/Response validator schemas
│   │   ├── routers/               # API Router Handlers
│   │   │   ├── assistant.py       # Core voice companion, STT/TTS routing
│   │   │   ├── harvestiq.py       # Vision diagnostics & crop failure risk
│   │   │   ├── mandi_prices.py    # Mandi price feeds & Prophet forecasters
│   │   │   ├── schemes.py         # Levenshtein fuzzy searches & eligibility
│   │   │   └── weather.py         # Weather feeds & regional forecast stats
│   │   ├── services/              # External API Integrations
│   │   │   ├── gemini_service.py  # Primary brain & Multimodal TTS PCM compiler
│   │   │   ├── groq_service.py    # Groq-Whisper audio transcriptions
│   │   │   ├── sentinel_hub_service.py # Sentinel-2 satellite NDVI processor
│   │   │   ├── tts_fallback.py    # Sarvam AI Bulbul v3 fallback service
│   │   │   └── vision_diagnostic_service.py # Disease diagnosis & Tavily price search
│   │   ├── database.py            # SQLite/Postgres DB core initialization
│   │   └── main.py                # FastAPI entry point & CORS configuration
│   ├── requirements.txt           # Main python dependency manifest
│   ├── update_db.py               # Mandi price fetch & DB seed helper
│   └── .env.example               # Backend environment setup layout
├── frontend/                      # React TypeScript Frontend
│   ├── src/
│   │   ├── components/            # Desktop View Components
│   │   │   ├── AgriWeather.tsx    # Weather risk graphs & alerts
│   │   │   ├── AssistantDrawer.tsx# Sidebar conversational chatbot drawer
│   │   │   ├── MandiInterface.tsx # Mandi price panels & visual search
│   │   │   ├── MarketDashboard.tsx# Core desktop dashboard, Schemes explorer
│   │   │   ├── VisualScanner.tsx  # Vision disease uploader panel
│   │   │   └── RiskDashboard.tsx  # Dynamic agricultural risk parameters
│   │   ├── mobile/                # Mobile Layouts & Views
│   │   │   ├── MobileApp.tsx      # Main layout for mobile screens
│   │   │   └── components/        # Mobile-adapted components
│   │   │       ├── MobileMandiInterface.tsx
│   │   │       ├── MobileMarketDashboard.tsx
│   │   │       └── MobileRiskDashboard.tsx
│   │   ├── services/              # Base Axios API services
│   │   ├── App.tsx                # Primary Desktop view root
│   │   ├── index.css              # Custom styling definitions
│   │   └── main.tsx               # Client bootstrap entry
│   ├── package.json               # Node package configuration
│   └── vite.config.ts             # Vite setup with proxy options
├── run.py                         # Root double-stack runner script
└── requirements.txt               # Legacy project requirements
```

---

## ⚙️ Environment Configuration

Create a `.env` file inside the `backend/` directory using the structure below:

```ini
# Core LLM & Brain Keys
GEMINI_API_KEY=your_gemini_api_key_here
HUGGINGFACE_API_KEY=your_huggingface_api_key_here  # Used for IndicTrans2 Indic-to-English translations
SECRET_KEY=generate_a_random_jwt_secret_key_here

# Dual Database Architecture
AUTH_DATABASE_URL=postgresql://user:pass@host:port/auth_db
MANDI_DATABASE_URL=postgresql://user:pass@host:port/mandi_db
LOCAL_MANDI_URL=postgresql+pg8000://user:pass@host:port/mandi_db

# NVIDIA NIM Model Configs (Used for streaming LLM response & Vision Diagnostics)
NVIDIA_API_KEY=your_nvidia_ngc_api_key_here
NVIDIA_NIM_LLM_URL=https://integrate.api.nvidia.com/v1/chat/completions
NVIDIA_LLM_MODEL=nvidia/nemotron-mini-4b-instruct

# Search & Research APIs
SERPER_API_KEY=your_serper_google_search_key_here
TAVILY_API_KEY=your_tavily_search_key_here  # Used for visual diagnostics remedy pricing

# Weather & Market APIs
OPENWEATHERMAP_API_KEY=your_openweathermap_api_key_here
GROQ_API_KEY=your_groq_api_key_here
DATAGOV_API_KEY=your_data_gov_in_api_key_here
AGMARKNET_API_KEY=your_agmarknet_api_key_here
OGD_API_KEY=your_ogd_api_key_here

# Sentinel Hub API (Copernicus 10m satellite NDVI)
SENTINELHUB_CLIENT_ID=your_sentinel_hub_client_id_here
SENTINELHUB_CLIENT_SECRET=your_sentinel_hub_client_secret_here

# Voice Fallback synthesis
SARVAM_API_KEY=your_sarvam_api_key_here  # Used for Bulbul v3 Indic voice fallbacks

# Secure Twilio SMS Alerts
TWILIO_ACCOUNT_SID=your_twilio_account_sid_here
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
TWILIO_PHONE_NUMBER=your_twilio_purchased_phone_number_here  # E.g., +1855XXXXXXX (Optional if Messaging Service SID is provided)
TWILIO_MESSAGING_SERVICE_SID=your_twilio_messaging_service_sid_here  # E.g., MGcbe87e67e798d1bd10d654e644cb43de
SMS_ENCRYPTION_KEY=generate_a_secure_symmetric_encryption_key_here  # Used for local stream cipher phone shielding
```

---

## 🔧 Installation & Manual Setup

### Prerequisites
* **Python 3.9+**
* **Node.js 18+ & npm**
* **FFmpeg** (Required by standard audio wrappers for transcription processing)

### Step 1: Clone and Set Up Backend
1. Navigate into the backend folder:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\Activate.ps1
   # On Linux/macOS:
   source venv/bin/activate
   ```
3. Install required packages:
   ```bash
   pip install -r requirements.txt
   ```
4. Perform database setup and crawl initial mandi rates:
   ```bash
   python update_db.py
   ```
5. Start the FastAPI server:
   ```bash
   uvicorn app.main:app --reload
   ```
   * *Backend API Docs are available at:* `http://localhost:8000/docs`

### Step 2: Set Up Frontend
1. Navigate into the frontend folder:
   ```bash
   cd ../frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Launch the React Vite development server:
   ```bash
   npm run dev
   ```
   * *Frontend Dashboard is available at:* `http://localhost:5173`

---

## 🤝 API Endpoints Guide

### 🎙️ Voice & Assistant Services
* **`POST /api/chat`**
  * Submits chat history and current user query to the Gemini Assistant model.
  * Supporting page-context injection.
* **`POST /api/voice/stt`**
  * Direct audio stream upload. Transcribes user spoken phrases into text using Groq Whisper.
* **`POST /api/voice/tts`**
  * Synthesizes assistant responses. Automatically processes text using Gemini TTS with fallbacks routing directly to Sarvam AI Bulbul. Returns a binary WAV stream.
* **`POST /api/page/analyze`**
  * Submits SPA swept layout data (DFS text chunks), returning a natural, localized summary of the page context.

### 👤 Profile & SMS Preferences Services
* **`GET /api/profile`**
  * Fetches user profile specifications, automatically returning a masked phone representation (e.g. `+91 ******3210`).
* **`PUT /api/profile`**
  * Securely updates user information, incorporating toggling of SMS alerting preferences (`sms_alerts_enabled`), setting custom rate-limits (`sms_cooldown_days`), and writing plaintext phone numbers in their cryptographically shielded database representation.

### 🏛️ Government Schemes Explorer
* **`GET /api/schemes`**
  * Retrieves full listing of agricultural schemes, with dynamic matching on query inputs.
* **`POST /api/schemes/eligibility`**
  * Checks farmer criteria against program profiles, returning structured eligibility diagnostics.

### 📊 Mandi Market Rates
* **`GET /api/mandi/prices`**
  * Returns localized mandi price records for specific states, districts, and commodities.
* **`GET /api/mandi/forecast`**
  * Generates Prophet predictive analysis arrays for historical mandis.

### 🏥 Crop Diagnostics (HarvestIQ)
* **`POST /api/harvestiq/diagnose`**
  * Image file upload route. Diagnoses crop leaf anomalies, maps organic remedies, and provides local pricing ranges.
* **`GET /api/harvestiq/ndvi`**
  * Pulls current Sentinel-2 NDVI vegetative readings based on GPS coordinates.
