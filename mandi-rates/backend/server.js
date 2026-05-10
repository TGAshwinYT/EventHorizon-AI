// ============================================================
//  Mandi Rates – Backend Server (Node.js + Express)
//  Run: node server.js
// ============================================================

const express = require("express");
const cors    = require("cors");
const fetch   = (...a) => import("node-fetch").then(({default:f})=>f(...a));
require("dotenv").config();

const app  = express();
app.use(cors());
app.use(express.json());

const PORT               = process.env.PORT || 5000;
const ANTHROPIC_API_KEY  = process.env.ANTHROPIC_API_KEY;   // your key from console.anthropic.com
const DATAGOV_API_KEY    = process.env.DATAGOV_API_KEY;     // your key from data.gov.in (optional)

// ── 1. REAL PRICES from data.gov.in ────────────────────────
//    Returns live mandi data if available, else falls back to AI
app.get("/api/real-price", async (req, res) => {
  const { crop, state, district } = req.query;

  // data.gov.in commodity names differ slightly; map common ones
  const commodityMap = {
    "Tomato":        "Tomato",
    "Onion":         "Onion",
    "Potato":        "Potato",
    "Cabbage":       "Cabbage",
    "Cauliflower":   "Cauliflower",
    "Brinjal":       "Brinjal",
    "Lady Finger (Bhindi)": "Bhindi(Ladies Finger)",
    "Green Chilli":  "Green Chilli",
    "Garlic":        "Garlic",
    "Ginger":        "Ginger",
    "Capsicum":      "Capsicum",
    "Carrot":        "Carrot",
    "Bitter Gourd":  "Bitter Gourd",
    "Bottle Gourd":  "Bottle Gourd",
    "Wheat":         "Wheat",
    "Rice (Paddy)":  "Rice",
    "Maize":         "Maize",
    "Soybean":       "Soybean",
    "Groundnut":     "Groundnut",
    "Banana":        "Banana",
    "Mango":         "Mango",
    "Turmeric":      "Turmeric",
  };

  const commodity = commodityMap[crop] || crop;

  if (!DATAGOV_API_KEY) {
    return res.json({ source: "no-datagov-key", data: [] });
  }

  try {
    // data.gov.in API – free, no daily limit for basic use
    const url = new URL("https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070");
    url.searchParams.set("api-key",   DATAGOV_API_KEY);
    url.searchParams.set("format",    "json");
    url.searchParams.set("limit",     "10");
    url.searchParams.set("filters[commodity]", commodity);
    url.searchParams.set("filters[state]",     state);
    if (district && district !== "All Districts") {
      url.searchParams.set("filters[district]", district);
    }

    const response = await fetch(url.toString());
    const json     = await response.json();
    const records  = (json.records || []).map(r => ({
      date:    r.arrival_date,
      market:  r.market,
      min:     Number(r.min_price),
      max:     Number(r.max_price),
      modal:   Number(r.modal_price),
    }));

    res.json({ source: "data.gov.in", data: records });
  } catch (err) {
    console.error("data.gov.in error:", err.message);
    res.json({ source: "error", data: [], error: err.message });
  }
});

// ── 2. AI PRICES from Claude (Anthropic) ───────────────────
//    Generates realistic estimated prices with 7-day history
app.post("/api/ai-price", async (req, res) => {
  const { crop, state, district } = req.body;

  if (!ANTHROPIC_API_KEY) {
    return res.status(400).json({ error: "ANTHROPIC_API_KEY not set in .env" });
  }

  const today   = new Date().toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
  const month   = new Date().toLocaleString("default", { month:"long" });
  const location = district && district !== "All Districts" ? `${district}, ${state}` : state;

  const prompt = `You are an Indian agricultural mandi market expert. Today is ${today}.

Give realistic current mandi prices for "${crop}" in ${location}, India.

Respond ONLY with raw JSON — no markdown, no explanation, nothing else:
{
  "modal": <number>,
  "min": <number>,
  "max": <number>,
  "change_pct": <number, e.g. 2.5 or -3.1>,
  "trend": "rising" | "falling" | "stable",
  "insight": "<one sentence about why prices are at this level in ${month}>",
  "history": [
    { "date": "DD Mon", "min": <number>, "max": <number>, "modal": <number> }
    ... 7 entries, oldest first, ending today
  ]
}

Rules:
- All prices in ₹ per quintal (100 kg)
- Use realistic seasonal prices for ${month} in India
- modal must be between min and max
- history should show realistic day-to-day variation (±3–8%)
- change_pct is today vs yesterday
- Return ONLY the JSON object`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: {
        "x-api-key":         ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type":      "application/json",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-20250514",
        max_tokens: 900,
        messages:   [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    const raw  = data.content.map(i => i.text || "").join("").trim().replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(raw);
    res.json({ source: "claude-ai", ...parsed });

  } catch (err) {
    console.error("Claude AI error:", err.message);
    res.status(500).json({ error: "AI price fetch failed", detail: err.message });
  }
});

app.listen(PORT, () => console.log(`✅  Mandi Rates API running → http://localhost:${PORT}`));
