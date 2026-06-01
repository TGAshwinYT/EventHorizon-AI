import { useState, useEffect } from 'react';
import { ShieldAlert, Droplets, Bug, CloudRain, ArrowLeft, AlertTriangle, Loader2, TrendingUp, MapPin, Wifi, List } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import CustomSelect from './CustomSelect';
import NdviCard from './NdviCard';
import { useUserStore } from '../store/userStore';

/* ────────────────────────────────────────────────────────────────────────── */
/*  Types                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

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

interface RiskDashboardProps { onBack: () => void; currentLanguage?: string; labels?: any; defaultState?: string; defaultDistrict?: string; }

type LocationMethod = 'detecting' | 'gps' | 'ip' | 'manual';

const CROPS = [
    'Rice', 'Wheat', 'Cotton', 'Tomato', 'Onion', 'Potato',
    'Sugarcane', 'Maize', 'Brinjal', 'Cabbage', 'Cauliflower',
    'Mango', 'Banana', 'Apple',
];

/* ────────────────────────────────────────────────────────────────────────── */
/*  Radial Gauge                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

function RadialGauge({ score, label, color, size = 120 }: { score: number; label: string; color: string; size?: number }) {
    const r = (size - 16) / 2, c = 2 * Math.PI * r, p = (score / 100) * c, cx = size / 2;
    return (
        <svg width={size} height={size} className="drop-shadow-lg">
            <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} />
            <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={10}
                strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - p}
                transform={`rotate(-90 ${cx} ${cx})`}
                style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)' }} />
            <text x={cx} y={cx - 6} textAnchor="middle" fill="white" fontSize={size * 0.25} fontWeight="bold">{score}</text>
            <text x={cx} y={cx + 14} textAnchor="middle" fill={color} fontSize={size * 0.11} fontWeight="600">{label}</text>
        </svg>
    );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

function riskColor(s: number) { return s < 25 ? '#22c55e' : s < 50 ? '#f59e0b' : s < 75 ? '#ef4444' : '#a855f7'; }
function riskGlow(s: number) { return s < 25 ? 'rgba(34,197,94,0.25)' : s < 50 ? 'rgba(245,158,11,0.25)' : s < 75 ? 'rgba(239,68,68,0.25)' : 'rgba(168,85,247,0.35)'; }

const METHOD_LABELS: Record<LocationMethod, { icon: any; label: string; color: string }> = {
    detecting: { icon: Loader2, label: 'Detecting location…', color: 'text-blue-400' },
    gps: { icon: MapPin, label: 'GPS Location', color: 'text-emerald-400' },
    ip: { icon: Wifi, label: 'IP Location', color: 'text-amber-400' },
    manual: { icon: List, label: 'Manual Selection', color: 'text-gray-400' },
};

/* ────────────────────────────────────────────────────────────────────────── */
/*  RiskDashboard Component                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export default function RiskDashboard({ onBack, currentLanguage, labels, defaultState, defaultDistrict }: RiskDashboardProps) {

    // Location tree from API
    const [locationTree, setLocationTree] = useState<Record<string, string[]>>({});
    const [locationMethod, setLocationMethod] = useState<LocationMethod>('detecting');

    // GPS coords (if detected)
    const [gpsCoords, setGpsCoords] = useState<{ lat: number; lon: number } | null>(null);

    const [selectedState, setSelectedState] = useState('');
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [selectedCrop, setSelectedCrop] = useState('Rice');

    const [data, setData] = useState<RiskData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);


    const states = Object.keys(locationTree).sort();
    const availableDistricts = selectedState ? (locationTree[selectedState] || []) : [];

    /* ── Fetch location tree ─────────────────────────────── */
    useEffect(() => {
        fetch('/api/harvestiq/locations')
            .then(r => r.ok ? r.json() : {})
            .then(tree => setLocationTree(tree))
            .catch(() => { /* silent — will fallback */ });
    }, []);

    /* ── 3-Layer Location Detection ──────────────────────── */
    useEffect(() => {
        let cancelled = false;

        const detectLocation = async () => {
            setLocationMethod('detecting');

            // Layer 1: GPS
            try {
                const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        timeout: 8000, maximumAge: 300000, enableHighAccuracy: false,
                    });
                });

                if (cancelled) return;
                const { latitude, longitude } = pos.coords;
                setGpsCoords({ lat: latitude, lon: longitude });
                setLocationMethod('gps');

                // Reverse resolve to get state/district for display
                try {
                    const res = await fetch('/api/harvestiq/assess', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            lat: latitude,
                            lon: longitude,
                            crop_name: selectedCrop,
                            lang: currentLanguage || 'en'
                        })
                    });
                    if (res.ok && !cancelled) {
                        const json: RiskData = await res.json();
                        setData(json);
                        // Extract state/district from location label
                        const parts = json.location.split(', ');
                        if (parts.length >= 2) {
                            setSelectedDistrict(parts[0]);
                            setSelectedState(parts[1]);
                        }
                    }
                } catch { /* will re-fetch below */ }
                return;
            } catch {
                // GPS denied or unavailable
            }

            if (cancelled) return;

            // Layer 2: IP Geolocation
            try {
                const res = await fetch('/api/harvestiq/detect-location');
                if (res.ok) {
                    const loc = await res.json();
                    if (!cancelled && loc.state && loc.district) {
                        setSelectedState(loc.state);
                        setSelectedDistrict(loc.district);
                        setLocationMethod('ip');
                        return;
                    }
                }
            } catch { /* silent */ }

            if (cancelled) return;

            // Layer 3: Manual fallback
            setLocationMethod('manual');
            // Set defaults
            if (!selectedState) {
                setSelectedState(defaultState || 'Tamil Nadu');
                setSelectedDistrict(defaultDistrict || 'Erode');
            }
        };

        detectLocation();
        return () => { cancelled = true; };
    }, []);

    /* ── Fetch risk data when location/crop changes ──────── */
    useEffect(() => {
        if (locationMethod === 'detecting') return;
        if (!selectedState && !gpsCoords) return;

        let cancelled = false;
        const doFetch = async () => {
            // Compute a precise cache key based on crop, location, and language
            const cacheKey = `hiq_${selectedCrop}_${
                locationMethod === 'gps' && gpsCoords 
                    ? `gps_${gpsCoords.lat.toFixed(4)}_${gpsCoords.lon.toFixed(4)}` 
                    : `${selectedState}_${selectedDistrict}`
            }_${currentLanguage || 'en'}`;

            // Check if we have cached results in sessionStorage
            try {
                const cached = sessionStorage.getItem(cacheKey);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    setData(parsed);
                    setLoading(false);
                    useUserStore.setState({ isPageLoading: false });
                    return;
                }
            } catch (e) {
                console.warn("[HarvestIQ] Failed to read from sessionStorage:", e);
            }

            setLoading(true);
            useUserStore.setState({ 
                isPageLoading: true,
                pageSummary: null,
                pageKeyPoints: [],
                pageSuggestedQuestions: []
            });
            setError(null);
            try {
                const payload: any = {
                    crop_name: selectedCrop,
                    lang: currentLanguage || 'en',
                    growth_stage: 'Vegetative' // Default
                };
                
                if (gpsCoords && locationMethod === 'gps') {
                    payload.lat = gpsCoords.lat;
                    payload.lon = gpsCoords.lon;
                } else {
                    payload.state = selectedState;
                    payload.district = selectedDistrict;
                }
                
                const res = await fetch('/api/harvestiq/assess', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) throw new Error(`Server returned ${res.status}`);
                const json: RiskData = await res.json();
                
                if (!cancelled) {
                    setData(json);
                    useUserStore.setState({ isPageLoading: false });
                    // Save to sessionStorage cache
                    try {
                        sessionStorage.setItem(cacheKey, JSON.stringify(json));
                    } catch (e) {
                        console.warn("[HarvestIQ] Failed to write to sessionStorage:", e);
                    }
                }
            } catch (err: any) {
                if (!cancelled) {
                    setError(err.message || 'Failed to fetch risk data');
                    useUserStore.setState({ isPageLoading: false });
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                    useUserStore.setState({ isPageLoading: false });
                }
            }
        };
        doFetch();
        return () => { cancelled = true; };
    }, [selectedState, selectedDistrict, selectedCrop, gpsCoords, locationMethod]);

    /* Switch to manual mode */
    const switchToManual = () => {
        setGpsCoords(null);
        setLocationMethod('manual');
        if (!selectedState) {
            if (defaultState) {
                setSelectedState(defaultState);
                setSelectedDistrict(defaultDistrict || '');
            } else if (states.length > 0) {
                setSelectedState(states[0]);
                const dists = locationTree[states[0]] || [];
                setSelectedDistrict(dists[0] || '');
            }
        }
    };

    /* Risk cards config */
    const riskCards = data ? [
        { key: 'drought', icon: Droplets, title: 'Drought Risk', ...data.risks.drought, emoji: '🔥' },
        { key: 'pest', icon: Bug, title: 'Pest Risk', ...data.risks.pest, emoji: '🐛' },
        { key: 'flood', icon: CloudRain, title: 'Flood Risk', ...data.risks.flood, emoji: '🌊' },
    ] : [];

    const methodInfo = METHOD_LABELS[locationMethod];
    const MethodIcon = methodInfo.icon;

    return (
        <div className="flex flex-col w-full h-full overflow-y-auto custom-scrollbar pb-8">
            <div className="w-full max-w-[1600px] mx-auto px-6 md:px-10 pt-20 space-y-8 animate-fade-in">

                {/* ── Header ──────────────────────────────────── */}
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-[#c084fc] to-[#3b82f6] bg-clip-text text-transparent">
                                HarvestIQ
                            </h1>
                            <div className="flex items-center gap-2 mt-1">
                                <MethodIcon className={`w-3.5 h-3.5 ${methodInfo.color} ${locationMethod === 'detecting' ? 'animate-spin' : ''}`} />
                                <span className={`text-xs ${methodInfo.color}`}>{methodInfo.label}</span>
                                {locationMethod !== 'manual' && locationMethod !== 'detecting' && (
                                    <button onClick={switchToManual} className="text-[10px] text-gray-500 hover:text-white underline underline-offset-2 ml-1 transition-colors">
                                        Change
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Selectors — show manual dropdown or auto-detected info */}
                    <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                        {(locationMethod === 'manual' || locationMethod === 'ip') && (
                            <>
                                <CustomSelect
                                    label={labels?.selectState || 'Select State'}
                                    value={selectedState}
                                    onChange={(val) => {
                                        setSelectedState(val);
                                        const nd = locationTree[val] || [];
                                        setSelectedDistrict(nd[0] || '');
                                        setLocationMethod('manual');
                                        setGpsCoords(null);
                                    }}
                                    options={states.length > 0 ? states : ['Tamil Nadu']}
                                    accentColor="amber"
                                />
                                <CustomSelect
                                    label={labels?.selectDistrict || 'Select District'}
                                    value={selectedDistrict}
                                    onChange={(val) => {
                                        setSelectedDistrict(val);
                                        setLocationMethod('manual');
                                        setGpsCoords(null);
                                    }}
                                    options={availableDistricts.length > 0 ? availableDistricts : ['Erode']}
                                    disabled={availableDistricts.length === 0}
                                    accentColor="amber"
                                />
                            </>
                        )}
                        {locationMethod === 'gps' && (
                            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
                                <MapPin className="w-4 h-4 text-emerald-400" />
                                <span className="text-sm text-emerald-300">{data?.location || 'Detecting…'}</span>
                            </div>
                        )}
                        <CustomSelect
                            label={labels?.selectCrop || 'Select Crop'}
                            value={selectedCrop}
                            onChange={setSelectedCrop}
                            options={CROPS}
                            accentColor="amber"
                        />
                    </div>
                </div>

                {/* ── Loading / Error ──────────────────────────── */}
                {(loading || locationMethod === 'detecting') && (
                    <div className="flex flex-col items-center justify-center py-32">
                        <Loader2 className="w-12 h-12 text-amber-400 animate-spin mb-4" />
                        <p className="text-gray-400 animate-pulse">
                            {locationMethod === 'detecting' ? 'Detecting your location…' : 'Analyzing risk factors for the new place…'}
                        </p>
                    </div>
                )}

                {error && !loading && (
                    <div className="flex flex-col items-center justify-center py-32">
                        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
                        <p className="text-gray-400">{error}</p>
                    </div>
                )}

                {/* ── Dashboard Content ────────────────────────── */}
                {data && !loading && locationMethod !== 'detecting' && (
                    <>
                        {/* Overall Risk + 3 Risk Gauges */}
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                            <div className="bg-[#111318]/90 backdrop-blur-xl rounded-3xl border border-white/5 p-8 flex flex-col items-center justify-center relative overflow-hidden"
                                style={{ boxShadow: `0 0 60px ${riskGlow(data.overall_risk)}` }}>
                                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
                                <ShieldAlert className="w-6 h-6 text-gray-500 mb-3" />
                                <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-4">Overall Risk</p>
                                <RadialGauge score={data.overall_risk} label={data.overall_label} color={riskColor(data.overall_risk)} size={160} />
                                <p className="text-xs text-gray-500 mt-4">{data.crop} • {data.location}</p>
                            </div>
                            {riskCards.map(card => {
                                const color = riskColor(card.score);
                                return (
                                    <div key={card.key}
                                        className="bg-[#111318]/90 backdrop-blur-xl rounded-3xl border border-white/5 p-6 flex flex-col items-center relative overflow-hidden group hover:-translate-y-1 transition-all duration-300"
                                        style={{ boxShadow: `0 0 40px ${riskGlow(card.score)}` }}>
                                        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
                                        <div className="flex items-center gap-2 mb-4">
                                            <span className="text-2xl">{card.emoji}</span>
                                            <h3 className="text-sm font-semibold text-gray-300">{card.title}</h3>
                                        </div>
                                        <RadialGauge score={card.score} label={card.label} color={color} size={120} />
                                    </div>
                                );
                            })}
                        </div>

                        {/* Weekly Trend Chart + Advisory Cards */}
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                            <div className="lg:col-span-3 bg-[#111318]/90 backdrop-blur-xl rounded-3xl border border-white/5 p-6 relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />
                                <div className="flex items-center gap-2 mb-6 relative z-10">
                                    <TrendingUp className="w-5 h-5 text-gray-400" />
                                    <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">5-Day Risk Trend</h3>
                                </div>
                                <div className="flex gap-6 mb-4 relative z-10">
                                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500" /><span className="text-xs text-gray-400">Drought</span></div>
                                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500" /><span className="text-xs text-gray-400">Pest</span></div>
                                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500" /><span className="text-xs text-gray-400">Flood</span></div>
                                </div>
                                <ResponsiveContainer width="100%" height={260} minWidth={0}>
                                    <AreaChart data={data.weekly_trend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="gDrought" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} /><stop offset="95%" stopColor="#f59e0b" stopOpacity={0} /></linearGradient>
                                            <linearGradient id="gPest" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} /><stop offset="95%" stopColor="#22c55e" stopOpacity={0} /></linearGradient>
                                            <linearGradient id="gFlood" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                        <XAxis dataKey="day" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <YAxis domain={[0, 100]} tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <Tooltip contentStyle={{ backgroundColor: '#1A1C23', borderColor: '#ffffff15', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }} itemStyle={{ color: '#fff', fontSize: '12px' }} labelStyle={{ color: '#9CA3AF', fontSize: '11px', marginBottom: '4px' }} />
                                        <Area type="monotone" dataKey="drought" name="Drought" stroke="#f59e0b" strokeWidth={2.5} fill="url(#gDrought)" activeDot={{ r: 5, fill: '#f59e0b', stroke: '#111318', strokeWidth: 2 }} />
                                        <Area type="monotone" dataKey="pest" name="Pest" stroke="#22c55e" strokeWidth={2.5} fill="url(#gPest)" activeDot={{ r: 5, fill: '#22c55e', stroke: '#111318', strokeWidth: 2 }} />
                                        <Area type="monotone" dataKey="flood" name="Flood" stroke="#3b82f6" strokeWidth={2.5} fill="url(#gFlood)" activeDot={{ r: 5, fill: '#3b82f6', stroke: '#111318', strokeWidth: 2 }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="lg:col-span-2 flex flex-col gap-4">
                                {riskCards.map(card => {
                                    const color = riskColor(card.score); const Icon = card.icon;
                                    return (
                                        <div key={`adv-${card.key}`} className="bg-[#111318]/90 backdrop-blur-xl rounded-2xl border border-white/5 p-5 relative overflow-hidden">
                                            <div className="absolute inset-0 bg-gradient-to-r from-white/[0.01] to-transparent pointer-events-none" />
                                            <div className="flex items-start gap-3 relative z-10">
                                                <div className="p-2 rounded-xl shrink-0" style={{ backgroundColor: `${color}15` }}>
                                                    <Icon className="w-5 h-5" style={{ color }} />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h4 className="text-sm font-semibold text-white">{card.title}</h4>
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ backgroundColor: `${color}20`, color }}>{card.label}</span>
                                                    </div>
                                                    <p className="text-xs text-gray-400 leading-relaxed">{card.advisory}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div className="bg-[#111318]/90 backdrop-blur-xl rounded-2xl border border-white/5 p-5 relative overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-r from-white/[0.01] to-transparent pointer-events-none" />
                                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 relative z-10">Crop Vulnerability — {data.crop}</h4>
                                    <div className="space-y-3 relative z-10">
                                        {[
                                            { label: 'Drought Sensitivity', value: data.crop_sensitivity.drought, color: '#f59e0b' },
                                            { label: 'Pest Sensitivity', value: data.crop_sensitivity.pest, color: '#22c55e' },
                                            { label: 'Flood Sensitivity', value: data.crop_sensitivity.flood, color: '#3b82f6' },
                                        ].map(bar => (
                                            <div key={bar.label}>
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="text-gray-400">{bar.label}</span>
                                                    <span className="font-semibold" style={{ color: bar.color }}>{(bar.value * 100).toFixed(0)}%</span>
                                                </div>
                                                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.min(bar.value * 100 / 1.5, 100)}%`, backgroundColor: bar.color }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Satellite NDVI Vegetation Health (Using existing NdviCard, though backend now also returns satellite) */}
                        <NdviCard
                            lat={gpsCoords?.lat || null}
                            lon={gpsCoords?.lon || null}
                            state={selectedState}
                            district={selectedDistrict}
                        />

                        {/* ── HarvestIQ Irrigation & AI Advisory ──────────────────────── */}
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-6">
                            
                            {/* Irrigation Schedule Calendar */}
                            {data.irrigation && (
                                <div className="xl:col-span-3 bg-[#111318]/90 backdrop-blur-xl rounded-3xl border border-white/5 p-6 relative overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-b from-blue-500/[0.02] to-transparent pointer-events-none" />
                                    <div className="flex items-center gap-2 mb-6 relative z-10">
                                        <CloudRain className="w-5 h-5 text-blue-400" />
                                        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">7-Day Irrigation Schedule</h3>
                                    </div>
                                    
                                    <div className="flex gap-4 mb-6 relative z-10">
                                        <div className="bg-white/5 rounded-xl px-4 py-2 border border-white/5">
                                            <span className="text-xs text-gray-500 block mb-1">Target</span>
                                            <span className="font-bold text-blue-400">{data.irrigation.weekly_target_mm}mm</span>
                                        </div>
                                        <div className="bg-white/5 rounded-xl px-4 py-2 border border-white/5">
                                            <span className="text-xs text-gray-500 block mb-1">Planned</span>
                                            <span className="font-bold text-emerald-400">{data.irrigation.total_planned_mm}mm</span>
                                        </div>
                                        <div className="bg-white/5 rounded-xl px-4 py-2 border border-white/5">
                                            <span className="text-xs text-gray-500 block mb-1">Expected Rain</span>
                                            <span className="font-bold text-gray-300">{data.irrigation.total_rain_expected_mm}mm</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 relative z-10">
                                        {data.irrigation.schedule.map((day, idx) => (
                                            <div key={idx} className={`rounded-2xl p-4 border flex flex-col items-center text-center transition-all ${day.action === 'water' ? 'bg-blue-500/10 border-blue-500/20' : 'bg-white/5 border-white/5'}`}>
                                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{day.day_name.substring(0, 3)}</span>
                                                <span className="text-[10px] text-gray-500 mb-3">{day.date.split('-').slice(1).join('/')}</span>
                                                
                                                <div className="flex-1 flex flex-col items-center justify-center min-h-[60px]">
                                                    {day.action === 'water' ? (
                                                        <>
                                                            <Droplets className="w-6 h-6 text-blue-400 mb-2" />
                                                            <span className="font-bold text-blue-300">{day.amount_mm}mm</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            {day.rain_expected_mm > 0 ? (
                                                                <CloudRain className="w-6 h-6 text-gray-400 mb-2" />
                                                            ) : (
                                                                <div className="w-6 h-6 border-2 border-dashed border-gray-600 rounded-full mb-2" />
                                                            )}
                                                            <span className="text-xs font-semibold text-gray-500 tracking-wider">SKIP</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
