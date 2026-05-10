import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Loader2, TrendingUp, AlertTriangle } from 'lucide-react';

interface ForecastData {
    date: string;
    displayDate?: string;
    price: number;
    isForecast: boolean;
}

interface MandiForecastingProps {
    crop: string;
    state: string;
    labels?: any;
}

const MobileMandiForecasting = ({ crop, state }: MandiForecastingProps) => {
    const [data, setData] = useState<ForecastData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        const fetchForecast = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`/api/market/forecast?crop=${encodeURIComponent(crop)}&state=${encodeURIComponent(state)}`);
                if (response.ok) {
                    const result = await response.json();
                    const formattedData = result.map((item: any) => {
                        const dateObj = new Date(item.date);
                        const month = dateObj.toLocaleString('default', { month: 'short' });
                        const day = dateObj.getDate();
                        return { ...item, displayDate: `${month} ${day}` };
                    });
                    setData(formattedData);
                }
            } catch (err) {
                console.error("Error fetching forecast:", err);
                setError("Unable to load forecast.");
            } finally {
                setLoading(false);
            }
        };

        if (crop && state) fetchForecast();
    }, [crop, state]);

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-48 w-full bg-white/5 rounded-2xl border border-white/5">
            <Loader2 className="w-6 h-6 text-emerald-400 animate-spin mb-2" />
            <p className="text-xs text-gray-400">Analyzing trends...</p>
        </div>
    );

    if (error || data.length === 0) return (
        <div className="flex flex-col items-center justify-center h-48 w-full bg-white/5 rounded-2xl border border-white/5">
            <AlertTriangle className="w-6 h-6 text-gray-500 mb-2" />
            <p className="text-xs text-gray-500">{error || "No data available."}</p>
        </div>
    );

    const historyData = data.filter(d => !d.isForecast);
    const latestHistory = historyData.length > 0 ? historyData[historyData.length - 1] : null;
    const forecastData = data.filter(d => d.isForecast);
    const connectedForecastData = (latestHistory && forecastData.length > 0) ? [latestHistory, ...forecastData] : forecastData;

    const prices = data.map(d => d.price);
    const minPrice = Math.max(0, Math.min(...prices) * 0.95);
    const maxPrice = Math.max(...prices) * 1.05;

    // Create a unified data structure for the chart
    const chartData = data.map(item => ({
        ...item,
        historyPrice: !item.isForecast ? item.price : null,
        forecastPrice: item.isForecast ? item.price : (item === latestHistory ? item.price : null)
    }));

    // If we have history, the first point of forecast should be the last point of history
    if (latestHistory) {
        const lastHistoryIndex = chartData.findIndex(d => d.date === latestHistory.date && !d.isForecast);
        if (lastHistoryIndex !== -1) {
            chartData[lastHistoryIndex].forecastPrice = latestHistory.price;
        }
    }

    return (
        <div className="w-full bg-white/5 rounded-2xl p-4 border border-white/10 relative overflow-hidden flex flex-col">
            <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-lg font-bold text-white">{crop} Forecast</h3>
                </div>
                <p className="text-[10px] text-gray-400">7-day AI prediction for {state}</p>
            </div>

            <div className="w-full h-[220px] min-w-0 relative">
                {isMounted && (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -5, bottom: 15 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                            <XAxis
                                dataKey="displayDate"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#4B5563', fontSize: 9 }}
                                dy={5}
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                domain={[minPrice, maxPrice]}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#4B5563', fontSize: 9 }}
                                tickFormatter={(value) => `₹${value}`}
                                width={55}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#111', borderColor: '#333', fontSize: '10px', padding: '4px', borderRadius: '8px' }}
                                itemStyle={{ padding: '0px' }}
                                formatter={(value: any) => [`₹${value}`, '']}
                            />
                            {latestHistory && (
                                <ReferenceLine
                                    x={latestHistory.displayDate}
                                    stroke="#ffffff15"
                                    strokeDasharray="3 3"
                                />
                            )}
                            <Line
                                type="monotone"
                                dataKey="historyPrice"
                                name="History"
                                stroke="#10b981"
                                strokeWidth={2.5}
                                dot={{ r: 3, fill: '#064e3b', stroke: '#10b981', strokeWidth: 1 }}
                                activeDot={{ r: 5, fill: '#10b981' }}
                                isAnimationActive={true}
                                connectNulls={false}
                            />
                            <Line
                                type="monotone"
                                dataKey="forecastPrice"
                                name="AI Forecast"
                                stroke="#10b981"
                                strokeWidth={2.5}
                                strokeDasharray="5 5"
                                dot={{ r: 3, fill: '#064e3b', stroke: '#10b981', strokeWidth: 1 }}
                                activeDot={{ r: 5, fill: '#34d399' }}
                                isAnimationActive={true}
                                connectNulls={true}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">History</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500/40" />
                    <span className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">AI Forecast</span>
                </div>
            </div>
        </div>
    );
};

export default MobileMandiForecasting;
