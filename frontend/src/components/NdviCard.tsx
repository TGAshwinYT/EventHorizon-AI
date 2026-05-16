import { useState, useEffect } from 'react';
import { Satellite, TrendingDown, TrendingUp, Minus, AlertTriangle, Loader2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';

/* ── Types ─────────────────────────────── */
interface NdviPoint {
    date: string;
    date_label: string;
    ndvi: number;
    classification: { status: string; color: string; emoji: string; health_pct: number };
}
interface NdviAdvisory { severity: string; title: string; message: string; }
interface NdviData {
    location: string;
    current: { ndvi: number; date: string; status: string; color: string; emoji: string; health_pct: number } | null;
    trend: { direction: string; change_16day: number; consecutive_drops: number; signal: string } | null;
    statistics: { min: number; max: number; mean: number; data_points: number } | null;
    time_series: NdviPoint[];
    advisory: NdviAdvisory;
    error?: string;
}

interface Props {
    lat: number | null;
    lon: number | null;
    state?: string;
    district?: string;
}

/* ── Trend Icon ────────────────────────── */
function TrendIcon({ direction }: { direction: string }) {
    if (direction === 'improving') return <TrendingUp className="w-4 h-4 text-emerald-400" />;
    if (direction === 'declining') return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
}

function severityColor(severity: string) {
    if (severity === 'critical') return 'border-red-500/30 bg-red-500/5';
    if (severity === 'warning') return 'border-amber-500/30 bg-amber-500/5';
    if (severity === 'positive') return 'border-emerald-500/30 bg-emerald-500/5';
    return 'border-white/5 bg-white/[0.02]';
}

/* ── Component ─────────────────────────── */
export default function NdviCard({ lat, lon, state, district }: Props) {
    const [data, setData] = useState<NdviData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!lat && !state) return;

        let cancelled = false;
        const fetchNdvi = async () => {
            setLoading(true);
            setError(null);
            try {
                let url = '/api/satellite/ndvi?periods=6';
                if (lat && lon) {
                    url += `&lat=${lat}&lon=${lon}`;
                } else if (state && district) {
                    url += `&state=${encodeURIComponent(state)}&district=${encodeURIComponent(district)}`;
                }
                const res = await fetch(url);
                if (!res.ok) throw new Error(`Server ${res.status}`);
                const json: NdviData = await res.json();
                if (!cancelled) setData(json);
            } catch (e: any) {
                if (!cancelled) setError(e.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        fetchNdvi();
        return () => { cancelled = true; };
    }, [lat, lon, state, district]);

    // Loading state
    if (loading && !data) {
        return (
            <div className="bg-[#111318]/90 backdrop-blur-xl rounded-3xl border border-white/5 p-6 relative overflow-hidden">
                <div className="flex items-center gap-3 mb-4">
                    <Satellite className="w-5 h-5 text-emerald-400 animate-pulse" />
                    <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Satellite NDVI</h3>
                </div>
                <div className="flex flex-col items-center py-8">
                    <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
                    <p className="text-xs text-gray-500">Fetching NASA MODIS data…</p>
                </div>
            </div>
        );
    }

    // Error or no data
    if (error || !data || !data.current) {
        return (
            <div className="bg-[#111318]/90 backdrop-blur-xl rounded-3xl border border-white/5 p-6 relative overflow-hidden">
                <div className="flex items-center gap-3 mb-4">
                    <Satellite className="w-5 h-5 text-gray-500" />
                    <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Satellite NDVI</h3>
                </div>
                <div className="flex items-center gap-3 text-gray-500 py-4">
                    <AlertTriangle className="w-5 h-5" />
                    <p className="text-xs">{error || data?.error || 'Satellite data unavailable'}</p>
                </div>
            </div>
        );
    }

    const { current, trend, statistics, time_series, advisory } = data;
    const chartData = time_series.map(p => ({ name: p.date_label, ndvi: p.ndvi }));

    return (
        <div className="bg-[#111318]/90 backdrop-blur-xl rounded-3xl border border-white/5 p-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between mb-5 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-emerald-500/10">
                        <Satellite className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">Satellite NDVI</h3>
                        <p className="text-[10px] text-gray-500">NASA MODIS • 250m resolution</p>
                    </div>
                </div>
                <div className="text-right">
                    <span className="text-[10px] text-gray-500">Last: {current.date}</span>
                </div>
            </div>

            {/* Current Status Row */}
            <div className="flex items-center gap-6 mb-5 relative z-10">
                {/* Big NDVI Number */}
                <div className="text-center">
                    <p className="text-3xl font-bold" style={{ color: current.color }}>{current.ndvi.toFixed(2)}</p>
                    <div className="flex items-center gap-1.5 justify-center mt-1">
                        <span className="text-lg">{current.emoji}</span>
                        <span className="text-xs font-semibold" style={{ color: current.color }}>{current.status}</span>
                    </div>
                </div>

                {/* Health Bar */}
                <div className="flex-1">
                    <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-gray-500">Vegetation Health</span>
                        <span className="font-semibold" style={{ color: current.color }}>{current.health_pct}%</span>
                    </div>
                    <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-1000 ease-out"
                            style={{ width: `${current.health_pct}%`, background: `linear-gradient(90deg, ${current.color}80, ${current.color})` }} />
                    </div>

                    {/* Trend Badge */}
                    {trend && (
                        <div className="flex items-center gap-2 mt-2">
                            <TrendIcon direction={trend.direction} />
                            <span className={`text-[10px] font-semibold ${
                                trend.direction === 'improving' ? 'text-emerald-400' :
                                trend.direction === 'declining' ? 'text-red-400' : 'text-gray-400'
                            }`}>
                                {trend.direction === 'improving' ? '↑' : trend.direction === 'declining' ? '↓' : '→'}{' '}
                                {Math.abs(trend.change_16day).toFixed(3)} / 16d
                            </span>
                            {trend.consecutive_drops >= 2 && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold">
                                    {trend.consecutive_drops}× drop
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* NDVI Chart */}
            {chartData.length > 1 && (
                <div className="mb-4 relative z-10">
                    <ResponsiveContainer width="100%" height={140} minWidth={0}>
                        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="gNdvi" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis dataKey="name" tick={{ fill: '#6B7280', fontSize: 9 }} axisLine={false} tickLine={false} />
                            <YAxis domain={[0, 1]} tick={{ fill: '#6B7280', fontSize: 9 }} axisLine={false} tickLine={false}
                                ticks={[0, 0.2, 0.4, 0.6, 0.8]} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1A1C23', borderColor: '#ffffff15', borderRadius: '12px', fontSize: '11px' }}
                                formatter={(val: any) => [Number(val).toFixed(4), 'NDVI']}
                            />
                            <ReferenceLine y={0.4} stroke="#f59e0b" strokeDasharray="5 5" strokeOpacity={0.4} />
                            <ReferenceLine y={0.2} stroke="#ef4444" strokeDasharray="5 5" strokeOpacity={0.4} />
                            <Area type="monotone" dataKey="ndvi" name="NDVI" stroke="#10b981" strokeWidth={2.5}
                                fill="url(#gNdvi)" dot={{ r: 3, fill: '#10b981', stroke: '#111318', strokeWidth: 2 }} />
                        </AreaChart>
                    </ResponsiveContainer>
                    <div className="flex gap-4 mt-1 justify-center">
                        <div className="flex items-center gap-1"><div className="w-5 h-[1px] bg-amber-500 opacity-40" style={{ borderTop: '1px dashed' }} /><span className="text-[8px] text-gray-600">Stress</span></div>
                        <div className="flex items-center gap-1"><div className="w-5 h-[1px] bg-red-500 opacity-40" style={{ borderTop: '1px dashed' }} /><span className="text-[8px] text-gray-600">Barren</span></div>
                    </div>
                </div>
            )}

            {/* Advisory */}
            <div className={`rounded-xl border p-3 relative z-10 ${severityColor(advisory.severity)}`}>
                <p className="text-xs font-semibold text-white mb-1">{advisory.title}</p>
                <p className="text-[11px] text-gray-400 leading-relaxed">{advisory.message}</p>
            </div>

            {/* Stats Footer */}
            {statistics && (
                <div className="flex gap-4 mt-4 relative z-10">
                    {[
                        { label: 'Min', value: statistics.min.toFixed(2) },
                        { label: 'Max', value: statistics.max.toFixed(2) },
                        { label: 'Avg', value: statistics.mean.toFixed(2) },
                        { label: 'Points', value: statistics.data_points },
                    ].map(s => (
                        <div key={s.label} className="text-center flex-1">
                            <p className="text-[10px] text-gray-600 uppercase">{s.label}</p>
                            <p className="text-xs font-semibold text-gray-300">{s.value}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
