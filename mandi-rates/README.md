# 🌾 Mandi Rates – Complete Setup Guide

---

## ❓ Answers to Your Questions

### Does it need a database?
NO. States, districts and crops are plain arrays in `data.js`.
Prices are fetched live — nothing to store.

### Are the prices real?
It works in 3 layers:
1. **data.gov.in** → REAL live mandi prices (free government API)
2. **Claude AI**   → Realistic seasonal estimates when live data missing
3. **Local fallback** → Seeded estimates when backend is offline

---

## 🚀 Step-by-Step Setup

### Step 1 – Get your API Keys

#### A) Anthropic (Claude AI) – for AI price estimates
1. Go to https://console.anthropic.com
2. Sign up / Log in
3. Click "API Keys" in the sidebar
4. Click "Create Key" → Copy it
5. Cost: ~$0.003 per price lookup (very cheap)

#### B) data.gov.in – for REAL mandi prices (FREE)
1. Go to https://data.gov.in/user/register
2. Register with your email
3. Go to https://data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070
4. Click "Get API" button → Copy your key
5. Cost: FREE (Government of India open data)

---

### Step 2 – Set up the Backend

```bash
# Open terminal, go to the backend folder
cd mandi-rates/backend

# Install dependencies
npm install

# Create your .env file
cp .env.example .env

# Open .env and paste your keys:
#   ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxx
#   DATAGOV_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Start the server
node server.js

# You should see:
# ✅  Mandi Rates API running → http://localhost:5000
```

---

### Step 3 – Set up the Frontend (React)

```bash
# Go to your React project folder
cd your-react-project

# Install required packages
npm install axios recharts

# Copy these files into your project:
#   src/data.js          ← crops + states + districts
#   src/components/MandiRates.jsx  ← main component

# Use it in your App.jsx:
import MandiRates from "./components/MandiRates";

function App() {
  return <MandiRates />;
}
```

---

### Step 4 – Test It

1. Backend running at http://localhost:5000
2. React app running (`npm start`)
3. Open your app → Select crop → State → District → Click "Get Price"

---

## 📁 File Structure

```
mandi-rates/
├── backend/
│   ├── server.js          ← Express API server
│   ├── .env.example       ← Copy to .env and fill keys
│   └── package.json
└── frontend/
    └── src/
        ├── data.js         ← All crops, states, districts
        └── MandiRates.jsx  ← React component (drop into your app)
```

---

## 🔗 Useful Links

| Resource | URL |
|---|---|
| Anthropic Console | https://console.anthropic.com |
| data.gov.in Mandi API | https://data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070 |
| Agmarknet (manual lookup) | https://agmarknet.gov.in |

---

## ⚠️ About Price Accuracy

| Source | Accuracy | Speed |
|---|---|---|
| data.gov.in | ✅ Real official mandi prices | ~2–5 sec |
| Claude AI | ⚠️ Realistic seasonal estimate | ~5–10 sec |
| Local fallback | ❌ Rough estimate only | instant |

**Recommendation:** Always use the data.gov.in key for production.
Claude AI is a good fallback when government data is missing for that crop/district.
