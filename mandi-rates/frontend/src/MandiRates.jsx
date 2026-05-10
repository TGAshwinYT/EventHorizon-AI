// ============================================================
//  MandiRates.jsx  –  Drop this into your React project
//
//  SETUP:
//  1. npm install axios recharts
//  2. Place this file in src/components/MandiRates.jsx
//  3. Place data.js  in src/data.js
//  4. Start your backend: cd backend && node server.js
//  5. Import and use: <MandiRates />
// ============================================================

import { useState, useEffect } from "react";
import axios from "axios";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { CROPS, STATES } from "../data";

// ── Change this to your backend URL when deployed ──────────
const API_BASE = "http://localhost:5000";

// ── Fallback: generates estimated prices when backend is down
function generateEstimate(crop, state, district) {
  const basePrices = {
    "Tomato":[800,3500],"Onion":[600,2800],"Potato":[500,2000],
    "Cabbage":[400,1500],"Cauliflower":[600,2500],"Brinjal":[400,2000],
    "Lady Finger (Bhindi)":[800,3000],"Bitter Gourd":[1000,3500],
    "Capsicum":[1200,5000],"Carrot":[800,2500],"Green Chilli":[1500,8000],
    "Garlic":[2000,12000],"Ginger":[3000,15000],"Peas":[1500,6000],
    "Banana":[800,2500],"Mango":[2000,8000],"Wheat":[1800,2500],
    "Rice (Paddy)":[1500,2200],"Maize":[1200,1800],"Soybean":[3500,5000],
    "Groundnut":[4500,7000],"Cotton":[5500,8000],"Turmeric":[6000,15000],
    "Red Chilli":[8000,20000],"Cumin":[15000,35000],"Mustard":[4500,6500],
  };
  const seed = (crop+state+district+new Date().toDateString())
    .split("").reduce((a,c)=>a+c.charCodeAt(0),0);
  let s = seed;
  const rng = () => { s=Math.sin(s)*10000; return s-Math.floor(s); };
  const [lo, hi] = basePrices[crop] || [500, 3000];
  const base = Math.round(lo + rng()*(hi-lo));
  const history = Array.from({length:7},(_,i)=>{
    const d = new Date(); d.setDate(d.getDate()-(6-i));
    const v = 0.88 + rng()*0.24;
    const modal = Math.round(base*v);
    const spread = Math.round(modal*(0.08+rng()*0.12));
    return { date:d.toLocaleDateString("en-IN",{day:"2-digit",month:"short"}), min:modal-spread, max:modal+spread, modal };
  });
  const last=history[6], prev=history[5];
  return {
    modal:last.modal, min:last.min, max:last.max,
    change_pct:((last.modal-prev.modal)/prev.modal*100).toFixed(1),
    trend:"stable",
    insight:`Estimated seasonal price for ${crop} in ${new Date().toLocaleString("default",{month:"long"})}.`,
    history,
    source:"estimate",
  };
}

// ── Custom Tooltip for Recharts ────────────────────────────
function PriceTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{background:"#1e293b",border:"1px solid #334155",borderRadius:8,padding:"10px 14px"}}>
      <p style={{color:"#94a3b8",fontSize:12,marginBottom:6}}>{label}</p>
      {payload.map(p=>(
        <p key={p.name} style={{color:p.color,fontSize:13,margin:"2px 0"}}>
          {p.name}: ₹{Number(p.value).toLocaleString("en-IN")}
        </p>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────
export default function MandiRates() {
  const [crop,     setCrop]     = useState(CROPS[0]);
  const [state,    setState]    = useState(Object.keys(STATES)[1]); // Tamil Nadu default
  const [district, setDistrict] = useState("All Districts");
  const [loading,  setLoading]  = useState(false);
  const [data,     setData]     = useState(null);
  const [notice,   setNotice]   = useState(null); // { type:"warn"|"error", msg }

  // Reset district when state changes
  useEffect(() => { setDistrict(STATES[state]?.at(-1) || "All Districts"); }, [state]);

  async function getPrice() {
    setLoading(true);
    setNotice(null);
    setData(null);

    // ── Step 1: Try real data.gov.in prices ─────────────
    try {
      const realRes = await axios.get(`${API_BASE}/api/real-price`, {
        params: { crop, state, district }, timeout: 8000,
      });
      if (realRes.data?.data?.length > 0) {
        const records = realRes.data.data;
        // Build summary from records
        const modals = records.map(r=>r.modal);
        const avg    = Math.round(modals.reduce((a,b)=>a+b,0)/modals.length);
        setData({
          modal: avg,
          min:   Math.min(...records.map(r=>r.min)),
          max:   Math.max(...records.map(r=>r.max)),
          change_pct: 0,
          trend: "stable",
          insight: `Live data from ${records.length} market(s) via data.gov.in`,
          history: records.slice(0,7).map(r=>({
            date:  r.date, min:r.min, max:r.max, modal:r.modal,
          })).reverse(),
          source: "data.gov.in (live)",
        });
        setLoading(false);
        return;
      }
    } catch (_) { /* backend not reachable, fall through */ }

    // ── Step 2: Try AI-estimated prices ─────────────────
    try {
      const aiRes = await axios.post(`${API_BASE}/api/ai-price`,
        { crop, state, district }, { timeout: 20000 });
      setData({ ...aiRes.data, source:"Claude AI (estimated)" });
      setNotice({ type:"warn", msg:"No live data found. Showing AI-estimated seasonal prices." });
    } catch (_) {
      // ── Step 3: Local fallback ───────────────────────
      setData(generateEstimate(crop, state, district));
      setNotice({ type:"error", msg:"Backend unreachable. Showing local seasonal estimates." });
    }

    setLoading(false);
  }

  const districts = STATES[state] || ["All Districts"];
  const chg       = data ? parseFloat(data.change_pct) : 0;

  // ── Styles (dark theme matching your UI) ─────────────────
  const s = {
    wrap:   { background:"#0f172a", minHeight:"100vh", padding:"1.5rem", color:"#f1f5f9", fontFamily:"system-ui,sans-serif" },
    card:   { background:"#1e293b", border:"1px solid #334155", borderRadius:12, padding:"1.25rem", marginBottom:"1rem" },
    label:  { fontSize:11, color:"#64748b", marginBottom:4, display:"block", letterSpacing:"0.05em" },
    select: { width:"100%", height:38, background:"#0f172a", border:"1px solid #334155", borderRadius:8, color:"#f1f5f9", fontSize:14, padding:"0 10px" },
    btn:    { width:"100%", height:42, background:"#22c55e", border:"none", borderRadius:8, color:"white", fontSize:14, fontWeight:600, cursor:"pointer" },
    btnDis: { width:"100%", height:42, background:"#374151", border:"none", borderRadius:8, color:"#9ca3af", fontSize:14, cursor:"not-allowed" },
    metric: { background:"#0f172a", borderRadius:8, padding:"0.9rem 1rem" },
    mLabel: { fontSize:11, color:"#64748b", marginBottom:6 },
    mValue: { fontSize:20, fontWeight:600 },
  };

  return (
    <div style={s.wrap}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:"1.5rem"}}>
        <button style={{background:"#1e293b",border:"1px solid #334155",borderRadius:8,padding:"6px 12px",color:"#94a3b8",cursor:"pointer"}}>←</button>
        <h1 style={{fontSize:20,fontWeight:600,color:"#f1f5f9"}}>🌾 Mandi Rates</h1>
        {data && <span style={{marginLeft:"auto",fontSize:11,color:"#64748b"}}>Source: {data.source}</span>}
      </div>

      {/* Filters */}
      <div style={s.card}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:12}}>
          <div>
            <label style={s.label}>Select Crop</label>
            <select style={s.select} value={crop} onChange={e=>setCrop(e.target.value)}>
              {CROPS.map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={s.label}>Select State</label>
            <select style={s.select} value={state} onChange={e=>setState(e.target.value)}>
              {Object.keys(STATES).map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={s.label}>Select District</label>
            <select style={s.select} value={district} onChange={e=>setDistrict(e.target.value)}>
              {districts.map(d=><option key={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <button
          style={loading ? s.btnDis : s.btn}
          disabled={loading}
          onClick={getPrice}
        >
          {loading ? "⏳ Fetching rates..." : "🔍 Get Price"}
        </button>
      </div>

      {/* Notice banner */}
      {notice && (
        <div style={{
          background: notice.type==="warn" ? "#fefce8" : "#fef2f2",
          border: `1px solid ${notice.type==="warn"?"#fcd34d":"#fecaca"}`,
          color:  notice.type==="warn" ? "#92400e" : "#b91c1c",
          borderRadius:8, padding:"10px 14px", fontSize:13, marginBottom:"1rem",
        }}>
          {notice.type==="warn" ? "⚠️" : "ℹ️"} {notice.msg}
        </div>
      )}

      {/* Metrics */}
      {data && (
        <>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:"1rem"}}>
            {[
              { label:"Today's Price", value:`₹${Number(data.modal).toLocaleString("en-IN")}`, sub:"per quintal" },
              { label:"Min Price",     value:`₹${Number(data.min).toLocaleString("en-IN")}`,   sub:"per quintal" },
              { label:"Max Price",     value:`₹${Number(data.max).toLocaleString("en-IN")}`,   sub:"per quintal" },
              {
                label:"Change",
                value:`${chg>=0?"+":""}${Number(chg).toFixed(1)}%`,
                sub: chg>=0?"↑ vs yesterday":"↓ vs yesterday",
                color: chg>=0?"#22c55e":"#ef4444",
              },
            ].map(m=>(
              <div key={m.label} style={s.metric}>
                <div style={s.mLabel}>{m.label}</div>
                <div style={{...s.mValue, color:m.color||"#f1f5f9"}}>{m.value}</div>
                <div style={{fontSize:11,color:"#64748b",marginTop:2}}>{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Insight */}
          {data.insight && (
            <div style={{...s.card, borderLeft:"3px solid #22c55e", paddingLeft:"1rem", fontSize:13, color:"#94a3b8"}}>
              💡 {data.insight}
            </div>
          )}

          {/* Chart */}
          {data.history?.length > 0 && (
            <div style={s.card}>
              <h3 style={{fontSize:14,fontWeight:600,marginBottom:"1rem",color:"#f1f5f9"}}>📈 Price History (7 days)</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.history} margin={{top:5,right:10,bottom:5,left:10}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{fill:"#64748b",fontSize:11}} />
                  <YAxis tick={{fill:"#64748b",fontSize:11}} tickFormatter={v=>`₹${(v/1000).toFixed(1)}k`} />
                  <Tooltip content={<PriceTooltip />} />
                  <Legend wrapperStyle={{fontSize:12,color:"#94a3b8"}} />
                  <Line type="monotone" dataKey="modal" name="Modal" stroke="#22c55e" strokeWidth={2} dot={{r:4}} />
                  <Line type="monotone" dataKey="max"   name="Max"   stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 3" dot={{r:3}} />
                  <Line type="monotone" dataKey="min"   name="Min"   stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 3" dot={{r:3}} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Table */}
          {data.history?.length > 0 && (
            <div style={s.card}>
              <h3 style={{fontSize:14,fontWeight:600,marginBottom:"1rem",color:"#f1f5f9"}}>📅 Recent Prices</h3>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead>
                  <tr>{["Date","Min (₹)","Max (₹)","Modal (₹)"].map(h=>(
                    <th key={h} style={{textAlign:h==="Date"?"left":"right",padding:"6px 0",color:"#64748b",borderBottom:"1px solid #334155",fontWeight:500}}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {[...data.history].reverse().map((r,i)=>(
                    <tr key={i}>
                      <td style={{padding:"8px 0",borderBottom:"1px solid #1e293b",color:"#94a3b8"}}>{r.date}</td>
                      <td style={{padding:"8px 0",borderBottom:"1px solid #1e293b",textAlign:"right"}}>{Number(r.min).toLocaleString("en-IN")}</td>
                      <td style={{padding:"8px 0",borderBottom:"1px solid #1e293b",textAlign:"right"}}>{Number(r.max).toLocaleString("en-IN")}</td>
                      <td style={{padding:"8px 0",borderBottom:"1px solid #1e293b",textAlign:"right",color:"#22c55e",fontWeight:600}}>{Number(r.modal).toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!data && !loading && (
        <div style={{...s.card,textAlign:"center",padding:"3rem"}}>
          <div style={{fontSize:40,marginBottom:12}}>🌾</div>
          <p style={{color:"#64748b",fontSize:14}}>Select a crop, state, and district, then click <strong style={{color:"#f1f5f9"}}>Get Price</strong></p>
        </div>
      )}
    </div>
  );
}
