import { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Droplets, Bug, CloudRain, ArrowLeft, AlertTriangle, Loader2, TrendingUp, MapPin, Wifi, List, Play, Volume2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import CustomSelect from '../../components/CustomSelect';
import NdviCard from '../../components/NdviCard';

/* ── Types ─────────────────────────────────────────── */
interface RiskDetail { score: number; label: string; advisory: string; }
interface TrendPoint { day: string; drought: number; pest: number; flood: number; }
interface RiskData {
    location: string; crop: string; assessment_date: string;
    overall_risk: number; overall_label: string;
    risks: { drought: RiskDetail; pest: RiskDetail; flood: RiskDetail; };
    weekly_trend: TrendPoint[];
    crop_sensitivity: { drought: number; pest: number; flood: number };
    satellite?: any;
    irrigation?: {
        weekly_target_mm: number;
        total_planned_mm: number;
        total_rain_expected_mm: number;
        schedule: Array<{ date: string; day_name: string; action: string; amount_mm: number; rain_expected_mm: number; reason: string }>;
    };
    ai_advisory?: string;
}
interface Props { onBack: () => void; currentLanguage?: string; labels?: any; }
type LocMethod = 'detecting' | 'gps' | 'ip' | 'manual';

const CROPS = ['Rice','Wheat','Cotton','Tomato','Onion','Potato','Sugarcane','Maize','Brinjal','Cabbage','Cauliflower','Mango','Banana','Apple'];

/* ── Gauge ─────────────────────────────────────────── */
function RadialGauge({ score, label, color, size = 100 }: { score: number; label: string; color: string; size?: number }) {
    const r = (size - 14) / 2, c = 2 * Math.PI * r, p = (score / 100) * c, cx = size / 2;
    return (
        <svg width={size} height={size}>
            <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
            <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round"
                strokeDasharray={c} strokeDashoffset={c - p} transform={`rotate(-90 ${cx} ${cx})`}
                style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)' }} />
            <text x={cx} y={cx - 4} textAnchor="middle" fill="white" fontSize={size * 0.26} fontWeight="bold">{score}</text>
            <text x={cx} y={cx + 12} textAnchor="middle" fill={color} fontSize={size * 0.11} fontWeight="600">{label}</text>
        </svg>
    );
}

function riskColor(s: number) { return s < 25 ? '#22c55e' : s < 50 ? '#f59e0b' : s < 75 ? '#ef4444' : '#a855f7'; }
function riskGlow(s: number) { return s < 25 ? 'rgba(34,197,94,0.2)' : s < 50 ? 'rgba(245,158,11,0.2)' : s < 75 ? 'rgba(239,68,68,0.2)' : 'rgba(168,85,247,0.3)'; }

/* ── Component ─────────────────────────────────────── */
export default function MobileRiskDashboard({ onBack, currentLanguage, labels }: Props) {
    const [locationTree, setLocationTree] = useState<Record<string, string[]>>({});
    const [locMethod, setLocMethod] = useState<LocMethod>('detecting');
    const [gpsCoords, setGpsCoords] = useState<{ lat: number; lon: number } | null>(null);
    const [selectedState, setSelectedState] = useState('');
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [selectedCrop, setSelectedCrop] = useState('Rice');
    const [data, setData] = useState<RiskData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [ttsState, setTtsState] = useState<'idle' | 'loading' | 'playing'>('idle');
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const playTTS = async () => {
        if (!data?.ai_advisory) return;
        if (ttsState === 'playing') {
            audioRef.current?.pause();
            setTtsState('idle');
            return;
        }

        setTtsState('loading');
        try {
            const token = sessionStorage.getItem('token');
            const res = await fetch('/api/chat/tts', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    text: data.ai_advisory,
                    language: currentLanguage || 'en'
                })
            });

            if (!res.ok) throw new Error('TTS failed');
            
            const ttsData = await res.json();
            if (ttsData.audio_url) {
                const audio = new Audio(ttsData.audio_url);
                audioRef.current = audio;
                
                audio.onplay = () => setTtsState('playing');
                audio.onended = () => setTtsState('idle');
                audio.onerror = () => setTtsState('idle');
                
                audio.play().catch(() => setTtsState('idle'));
            } else {
                setTtsState('idle');
            }
        } catch (err) {
            console.error(err);
            setTtsState('idle');
            alert('Failed to play audio.');
        }
    };

    const states = Object.keys(locationTree).sort();
    const districts = selectedState ? (locationTree[selectedState] || []) : [];

    useEffect(() => {
        fetch('/api/harvestiq/locations').then(r => r.ok ? r.json() : {}).then(t => setLocationTree(t)).catch(() => {});
    }, []);

    /* 3-Layer Detection */
    useEffect(() => {
        let cancelled = false;
        const detect = async () => {
            setLocMethod('detecting');
            // Layer 1: GPS
            try {
                const pos = await new Promise<GeolocationPosition>((res, rej) => {
                    navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000, maximumAge: 300000, enableHighAccuracy: false });
                });
                if (cancelled) return;
                setGpsCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
                setLocMethod('gps');
                try {
                    const r = await fetch('/api/harvestiq/assess', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            lat: pos.coords.latitude,
                            lon: pos.coords.longitude,
                            crop_name: selectedCrop,
                            lang: labels?.lang || 'en'
                        })
                    });
                    if (r.ok && !cancelled) {
                        const json: RiskData = await r.json();
                        setData(json);
                        const parts = json.location.split(', ');
                        if (parts.length >= 2) { setSelectedDistrict(parts[0]); setSelectedState(parts[1]); }
                    }
                } catch {}
                return;
            } catch {}
            if (cancelled) return;
            // Layer 2: IP
            try {
                const r = await fetch('/api/harvestiq/detect-location');
                if (r.ok) {
                    const loc = await r.json();
                    if (!cancelled && loc.state && loc.district) {
                        setSelectedState(loc.state); setSelectedDistrict(loc.district); setLocMethod('ip'); return;
                    }
                }
            } catch {}
            if (cancelled) return;
            // Layer 3: Manual
            setLocMethod('manual');
            if (!selectedState) { setSelectedState('Tamil Nadu'); setSelectedDistrict('Erode'); }
        };
        detect();
        return () => { cancelled = true; };
    }, []);

    /* Fetch risk */
    useEffect(() => {
        if (locMethod === 'detecting') return;
        if (!selectedState && !gpsCoords) return;
        let cancelled = false;
        const doFetch = async () => {
            setLoading(true); setError(null);
            try {
                const payload: any = { crop_name: selectedCrop, lang: labels?.lang || 'en' };
                if (locMethod === 'gps' && gpsCoords) { payload.lat = gpsCoords.lat; payload.lon = gpsCoords.lon; }
                else { payload.state = selectedState; payload.district = selectedDistrict; }
                
                const r = await fetch('/api/harvestiq/assess', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!r.ok) throw new Error();
                const json: RiskData = await r.json();
                if (!cancelled) setData(json);
            } catch {
                if (!cancelled) setError('Failed to fetch data');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        doFetch();
        return () => { cancelled = true; };
    }, [selectedState, selectedDistrict, selectedCrop, gpsCoords, locMethod]);

    const switchToManual = () => {
        setGpsCoords(null); setLocMethod('manual');
        if (!selectedState && states.length > 0) { setSelectedState(states[0]); setSelectedDistrict((locationTree[states[0]] || [])[0] || ''); }
    };

    const riskCards = data ? [
        { key: 'drought', icon: Droplets, title: 'Drought', ...data.risks.drought, emoji: '🔥' },
        { key: 'pest', icon: Bug, title: 'Pest', ...data.risks.pest, emoji: '🐛' },
        { key: 'flood', icon: CloudRain, title: 'Flood', ...data.risks.flood, emoji: '🌊' },
    ] : [];

    const methodIcons: Record<LocMethod, { icon: any; label: string; color: string }> = {
        detecting: { icon: Loader2, label: 'Detecting…', color: 'text-blue-400' },
        gps: { icon: MapPin, label: 'GPS', color: 'text-emerald-400' },
        ip: { icon: Wifi, label: 'IP', color: 'text-amber-400' },
        manual: { icon: List, label: 'Manual', color: 'text-gray-400' },
    };
    const mi = methodIcons[locMethod]; const MI = mi.icon;

    return (
        <div className="flex flex-col w-full h-full overflow-y-auto custom-scrollbar">
            <div className="w-full px-4 pt-4 pb-8 space-y-5 animate-fade-in">

                {/* Header */}
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all shrink-0">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="min-w-0">
                        <h1 className="text-xl font-bold bg-gradient-to-r from-[#c084fc] to-[#3b82f6] bg-clip-text text-transparent">HarvestIQ</h1>
                        <div className="flex items-center gap-1.5">
                            <MI className={`w-3 h-3 ${mi.color} ${locMethod === 'detecting' ? 'animate-spin' : ''}`} />
                            <span className={`text-[10px] ${mi.color}`}>{mi.label}</span>
                            {locMethod !== 'manual' && locMethod !== 'detecting' && (
                                <button onClick={switchToManual} className="text-[9px] text-gray-500 hover:text-white underline ml-1">Change</button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Selectors */}
                <div className="flex flex-col gap-3">
                    {(locMethod === 'manual' || locMethod === 'ip') && (
                        <div className="flex gap-3">
                            <div className="flex-1">
                                <CustomSelect label={labels?.selectState || 'State'} value={selectedState}
                                    onChange={(v) => { setSelectedState(v); setSelectedDistrict((locationTree[v] || [])[0] || ''); setLocMethod('manual'); setGpsCoords(null); }}
                                    options={states.length > 0 ? states : ['Tamil Nadu']} accentColor="amber" />
                            </div>
                            <div className="flex-1">
                                <CustomSelect label={labels?.selectDistrict || 'District'} value={selectedDistrict}
                                    onChange={(v) => { setSelectedDistrict(v); setLocMethod('manual'); setGpsCoords(null); }}
                                    options={districts.length > 0 ? districts : ['Erode']}
                                    disabled={districts.length === 0} accentColor="amber" />
                            </div>
                        </div>
                    )}
                    {locMethod === 'gps' && (
                        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5">
                            <MapPin className="w-4 h-4 text-emerald-400" />
                            <span className="text-sm text-emerald-300 truncate">{data?.location || 'Detecting…'}</span>
                        </div>
                    )}
                    <CustomSelect label={labels?.selectCrop || 'Crop'} value={selectedCrop}
                        onChange={setSelectedCrop} options={CROPS} accentColor="amber" />
                </div>

                {/* Loading */}
                {(loading || locMethod === 'detecting') && !data && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="w-10 h-10 text-amber-400 animate-spin mb-3" />
                        <p className="text-gray-400 text-sm animate-pulse">{locMethod === 'detecting' ? 'Detecting location…' : 'Analyzing…'}</p>
                    </div>
                )}
                {error && !data && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <AlertTriangle className="w-10 h-10 text-red-500 mb-3" />
                        <p className="text-gray-400 text-sm">{error}</p>
                    </div>
                )}

                {data && (
                    <>
                        {/* Gauges */}
                        <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                            <div className="flex flex-col items-center justify-center bg-[#111318]/90 backdrop-blur-xl rounded-2xl border border-white/5 p-4 min-w-[140px] snap-center shrink-0"
                                style={{ boxShadow: `0 0 30px ${riskGlow(data.overall_risk)}` }}>
                                <ShieldAlert className="w-4 h-4 text-gray-500 mb-1" />
                                <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-2">Overall</p>
                                <RadialGauge score={data.overall_risk} label={data.overall_label} color={riskColor(data.overall_risk)} size={100} />
                            </div>
                            {riskCards.map(card => (
                                <div key={card.key} className="flex flex-col items-center justify-center bg-[#111318]/90 backdrop-blur-xl rounded-2xl border border-white/5 p-4 min-w-[130px] snap-center shrink-0"
                                    style={{ boxShadow: `0 0 25px ${riskGlow(card.score)}` }}>
                                    <span className="text-lg mb-1">{card.emoji}</span>
                                    <p className="text-[10px] text-gray-400 font-semibold mb-2">{card.title}</p>
                                    <RadialGauge score={card.score} label={card.label} color={riskColor(card.score)} size={90} />
                                </div>
                            ))}
                        </div>

                        {/* Trend */}
                        <div className="bg-[#111318]/90 backdrop-blur-xl rounded-2xl border border-white/5 p-4 relative overflow-hidden">
                            <div className="flex items-center gap-2 mb-3">
                                <TrendingUp className="w-4 h-4 text-gray-400" />
                                <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">5-Day Trend</h3>
                            </div>
                            <div className="flex gap-4 mb-3">
                                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500" /><span className="text-[10px] text-gray-500">Drought</span></div>
                                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-[10px] text-gray-500">Pest</span></div>
                                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /><span className="text-[10px] text-gray-500">Flood</span></div>
                            </div>
                            <ResponsiveContainer width="100%" height={180} minWidth={0}>
                                <AreaChart data={data.weekly_trend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="mgD" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} /><stop offset="95%" stopColor="#f59e0b" stopOpacity={0} /></linearGradient>
                                        <linearGradient id="mgP" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} /><stop offset="95%" stopColor="#22c55e" stopOpacity={0} /></linearGradient>
                                        <linearGradient id="mgF" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                    <XAxis dataKey="day" tick={{ fill: '#9CA3AF', fontSize: 9 }} axisLine={false} tickLine={false} />
                                    <YAxis domain={[0, 100]} tick={{ fill: '#9CA3AF', fontSize: 9 }} axisLine={false} tickLine={false} />
                                    <Tooltip contentStyle={{ backgroundColor: '#1A1C23', borderColor: '#ffffff15', borderRadius: '12px', fontSize: '11px' }} itemStyle={{ color: '#fff' }} />
                                    <Area type="monotone" dataKey="drought" name="Drought" stroke="#f59e0b" strokeWidth={2} fill="url(#mgD)" />
                                    <Area type="monotone" dataKey="pest" name="Pest" stroke="#22c55e" strokeWidth={2} fill="url(#mgP)" />
                                    <Area type="monotone" dataKey="flood" name="Flood" stroke="#3b82f6" strokeWidth={2} fill="url(#mgF)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Advisory */}
                        <div className="space-y-3">
                            {riskCards.map(card => {
                                const color = riskColor(card.score); const Icon = card.icon;
                                return (
                                    <div key={`adv-${card.key}`} className="bg-[#111318]/90 backdrop-blur-xl rounded-2xl border border-white/5 p-4">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 rounded-xl shrink-0" style={{ backgroundColor: `${color}15` }}>
                                                <Icon className="w-4 h-4" style={{ color }} />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className="text-xs font-semibold text-white">{card.title} Risk</h4>
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase" style={{ backgroundColor: `${color}20`, color }}>{card.label}</span>
                                                </div>
                                                <p className="text-[11px] text-gray-400 leading-relaxed">{card.advisory}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Crop Sensitivity */}
                        <div className="bg-[#111318]/90 backdrop-blur-xl rounded-2xl border border-white/5 p-4">
                            <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Crop Vulnerability — {data.crop}</h4>
                            <div className="space-y-2.5">
                                {[
                                    { label: 'Drought', value: data.crop_sensitivity.drought, color: '#f59e0b' },
                                    { label: 'Pest', value: data.crop_sensitivity.pest, color: '#22c55e' },
                                    { label: 'Flood', value: data.crop_sensitivity.flood, color: '#3b82f6' },
                                ].map(bar => (
                                    <div key={bar.label}>
                                        <div className="flex justify-between text-[10px] mb-1">
                                            <span className="text-gray-400">{bar.label}</span>
                                            <span className="font-semibold" style={{ color: bar.color }}>{(bar.value * 100).toFixed(0)}%</span>
                                        </div>
                                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full transition-all duration-1000 ease-out"
                                                style={{ width: `${Math.min(bar.value * 100 / 1.5, 100)}%`, backgroundColor: bar.color }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <NdviCard
                            lat={gpsCoords?.lat || null}
                            lon={gpsCoords?.lon || null}
                            state={selectedState}
                            district={selectedDistrict}
                        />

                        {/* Irrigation Schedule */}
                        {data.irrigation && (
                            <div className="bg-[#111318]/90 backdrop-blur-xl rounded-2xl border border-white/5 p-4">
                                <div className="flex items-center gap-2 mb-4">
                                    <CloudRain className="w-4 h-4 text-blue-400" />
                                    <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">7-Day Irrigation</h3>
                                </div>
                                <div className="flex justify-between mb-4">
                                    <div className="bg-white/5 rounded-lg px-2 py-1.5 flex-1 mx-1 text-center border border-white/5">
                                        <span className="text-[9px] text-gray-500 block">Target</span>
                                        <span className="font-bold text-blue-400 text-xs">{data.irrigation.weekly_target_mm}mm</span>
                                    </div>
                                    <div className="bg-white/5 rounded-lg px-2 py-1.5 flex-1 mx-1 text-center border border-white/5">
                                        <span className="text-[9px] text-gray-500 block">Planned</span>
                                        <span className="font-bold text-emerald-400 text-xs">{data.irrigation.total_planned_mm}mm</span>
                                    </div>
                                    <div className="bg-white/5 rounded-lg px-2 py-1.5 flex-1 mx-1 text-center border border-white/5">
                                        <span className="text-[9px] text-gray-500 block">Rain</span>
                                        <span className="font-bold text-gray-300 text-xs">{data.irrigation.total_rain_expected_mm}mm</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-4 gap-2">
                                    {data.irrigation.schedule.map((day, idx) => (
                                        <div key={idx} className={`rounded-xl p-2 border flex flex-col items-center text-center ${day.action === 'water' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-white/5 border-white/5'}`}>
                                            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{day.day_name.substring(0, 3)}</span>
                                            <span className="text-[8px] text-gray-500 mb-2">{day.date.split('-').slice(1).join('/')}</span>
                                            {day.action === 'water' ? (
                                                <>
                                                    <Droplets className="w-4 h-4 text-blue-400 mb-1" />
                                                    <span className="font-bold text-blue-300 text-[10px]">{day.amount_mm}</span>
                                                </>
                                            ) : (
                                                <>
                                                    {day.rain_expected_mm > 0 ? (
                                                        <CloudRain className="w-4 h-4 text-gray-400 mb-1" />
                                                    ) : (
                                                        <div className="w-4 h-4 border border-dashed border-gray-600 rounded-full mb-1" />
                                                    )}
                                                    <span className="text-[8px] font-semibold text-gray-500">SKIP</span>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* AI Advisory */}
                        {data.ai_advisory && (
                            <div className="bg-[#111318]/90 backdrop-blur-xl rounded-2xl border border-white/5 p-4 flex flex-col">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-sm">✨</span>
                                    <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">AI Advisory</h3>
                                </div>
                                <div className="bg-white/5 rounded-xl p-3 border border-white/5 mb-3">
                                    <p className="text-gray-300 text-[11px] leading-relaxed">{data.ai_advisory}</p>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        className={`flex-1 border rounded-lg py-2 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                                            ttsState === 'playing' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                            ttsState === 'loading' ? 'bg-purple-600/10 text-purple-400 border-purple-500/30 opacity-70' :
                                            'bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border-purple-500/30'
                                        }`}
                                        onClick={playTTS}
                                        disabled={ttsState === 'loading'}
                                    >
                                        {ttsState === 'loading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 
                                         ttsState === 'playing' ? <Volume2 className="w-3.5 h-3.5" /> : 
                                         <Play className="w-3.5 h-3.5" />}
                                        {ttsState === 'playing' ? 'Playing...' : 
                                         ttsState === 'loading' ? 'Loading...' : 'Play Audio'}
                                    </button>
                                    <button 
                                        className="flex-1 bg-white/5 text-gray-300 border border-white/10 rounded-lg py-2 text-[11px] font-bold transition-all active:scale-95"
                                        onClick={async () => {
                                            try {
                                                const smsRes = await fetch(`/api/harvestiq/advisory/sms?crop=${encodeURIComponent(selectedCrop)}&lat=${gpsCoords?.lat || 0}&lon=${gpsCoords?.lon || 0}&lang=${labels?.lang || 'en'}`);
                                                if(smsRes.ok) {
                                                    const smsData = await smsRes.json();
                                                    navigator.clipboard.writeText(smsData.sms_text);
                                                    alert("SMS copied to clipboard:\n\n" + smsData.sms_text);
                                                }
                                            } catch(e) { console.error(e); }
                                        }}
                                    >
                                        Copy SMS
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
