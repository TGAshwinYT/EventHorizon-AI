# EventHorizon AI

A voice-first, multilingual AI assistant for rural India, built with React and FastAPI.

## Prerequisites

- **Python 3.8+**
- **Node.js 18+** (Required for frontend)
- **AWS Credentials** (for future Bedrock/Polly integration)

## Setup Instructions

### 1. Backend (Python/FastAPI)

```bash
cd backend
# Create virtual environment (if not already active)
python -m venv venv

# Activate virtual environment (Windows PowerShell)
.\venv\Scripts\Activate.ps1
# If you get a permission error, run: Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process

# Install dependencies
pip install -r ../requirements.txt

# Run the server
uvicorn app.main:app --reload
```

The backend API will be available at `http://localhost:8000`.
Docs: `http://localhost:8000/docs`.

### 2. Frontend (React/Vite)

```bash
cd frontend

# Install dependencies (REQUIRED before running)
npm install

# Run the development server
npm run dev
```

The frontend will be available at `http://localhost:5173`.

## Architecture
- **VoiceOrb**: Central UI element for voice interaction.
- **Mock Mode**: Currently, the backend returns mock data for chat and market prices to avoid AWS costs during development.
