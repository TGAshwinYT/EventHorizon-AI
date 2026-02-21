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

const MandiForecasting = ({ crop, state, labels }: MandiForecastingProps) => {
    const [data, setData] = useState<ForecastData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchForecast = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`/api/market/forecast?crop=${encodeURIComponent(crop)}&state=${encodeURIComponent(state)}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch forecast data');
                }
                const result = await response.json();

                // Format dates for display (e.g. "Feb 21")
                const formattedData = result.map((item: any) => {
                    const dateObj = new Date(item.date);
                    const month = dateObj.toLocaleString('default', { month: 'short' });
                    const day = dateObj.getDate();
                    return {
                        ...item,
                        displayDate: `${month} ${day}`
                    };
                });

                setData(formattedData);
            } catch (err) {
                console.error("Error fetching forecast:", err);
                setError("Unable to load price forecast. Please try again later.");
            } finally {
                setLoading(false);
            }
        };

        if (crop && state) {
            fetchForecast();
        }
    }, [crop, state]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 w-full bg-[#1A1B23] rounded-2xl border border-white/5">
                <Loader2 className="w-8 h-8 text-[#00FF7F] animate-spin mb-4" />
                <p className="text-gray-400">Analyzing market trends...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-64 w-full bg-[#1A1B23] rounded-2xl border border-red-500/20">
                <AlertTriangle className="w-8 h-8 text-red-400 mb-4" />
                <p className="text-gray-400">{error}</p>
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 w-full bg-[#1A1B23] rounded-2xl border border-white/5">
                <TrendingUp className="w-8 h-8 text-gray-600 mb-4" />
                <p className="text-gray-500">Not enough historical data to generate a forecast.</p>
            </div>
        );
    }

    // Split data for visually distinct lines
    // We want the lines to connect, so the first point of forecast should be the last of history
    const historyData = data.filter(d => !d.isForecast);
    const latestHistory = historyData.length > 0 ? historyData[historyData.length - 1] : null;

    const forecastData = data.filter(d => d.isForecast);

    // Connect the lines by adding the last historical point to the start of the forecast line
    // but only if both exist
    const connectedForecastData = (latestHistory && forecastData.length > 0)
        ? [latestHistory, ...forecastData]
        : forecastData;

    // Find min and max for Y-axis domain to make chart look better
    const prices = data.map(d => d.price);
    const minPrice = Math.max(0, Math.min(...prices) * 0.9); // 10% padding below
    const maxPrice = Math.max(...prices) * 1.1; // 10% padding above

    // Custom Tooltip
    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const dataPoint = payload[0].payload;
            return (
                <div className="bg-[#1A1B23] border border-white/10 p-4 rounded-xl shadow-2xl backdrop-blur-md">
                    <p className="text-gray-400 mb-1">{dataPoint.displayDate}</p>
                    <p className="text-2xl font-bold flex items-center gap-2">
                        <span className={dataPoint.isForecast ? "text-amber-400" : "text-[#00FF7F]"}>
                            ₹{dataPoint.price}
                        </span>
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${dataPoint.isForecast ? "bg-amber-400" : "bg-[#00FF7F]"}`} />
                        <span className="text-sm text-gray-300">
                            {dataPoint.isForecast ? (labels?.aiPrediction || "7-Day AI Prediction") : (labels?.historicalHistory || "Historical Price")}
                        </span>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="w-full bg-[#1A1B23] rounded-3xl p-4 sm:p-6 border border-white/5 shadow-xl relative overflow-hidden min-w-0">
            {/* Background Gradient Effect */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#00FF7F]/5 rounded-full blur-[80px] pointer-events-none -translate-y-1/2 translate-x-1/2" />

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 relative z-10">
                <div>
                    <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                        <TrendingUp className="w-6 h-6 text-[#00FF7F]" />
                        {labels?.priceForecast || 'Price Forecast'}: {crop}
                    </h3>
                    <p className="text-gray-400 mt-1">
                        {labels?.aiPredictionFor ? labels.aiPredictionFor.replace('{state}', state) : `AI-powered 7-day price prediction for ${state}`}
                    </p>
                </div>

                <div className="flex items-center gap-6 mt-4 md:mt-0 text-sm bg-black/20 p-3 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-1 bg-[#00FF7F] rounded-full" />
                        <span className="text-gray-300">{labels?.historicalHistory || 'Historical History'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                            <div className="w-1 h-1 bg-[#00FF7F] rounded-full" />
                            <div className="w-1 h-1 bg-[#00FF7F] rounded-full" />
                            <div className="w-1 h-1 bg-[#00FF7F] rounded-full" />
                        </div>
                        <span className="text-gray-300">{labels?.aiPrediction || 'AI Prediction'}</span>
                    </div>
                </div>
            </div>

            <div className="w-full h-[350px] relative z-10 sm:-ml-2 pr-2 sm:pr-0">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart margin={{ top: 20, right: 10, left: 0, bottom: 20 }}>
                        <defs>
                            <linearGradient id="glow" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#00FF7F" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#00FF7F" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                        <XAxis
                            dataKey="displayDate"
                            type="category"
                            allowDuplicatedCategory={false}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#6B7280', fontSize: 12 }}
                            dy={10}
                        />
                        <YAxis
                            domain={[minPrice, maxPrice]}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#6B7280', fontSize: 12 }}
                            tickFormatter={(value) => `₹${value}`}
                            dx={-10}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#ffffff20', strokeWidth: 1, strokeDasharray: '5 5' }} />

                        {/* Current Date Divider */}
                        {latestHistory && (
                            <ReferenceLine
                                x={latestHistory.displayDate}
                                stroke="#ffffff30"
                                strokeDasharray="3 3"
                                label={{ position: 'top', value: labels?.todayStr || 'Today', fill: '#6B7280', fontSize: 12, dy: -10 }}
                            />
                        )}

                        {/* Historical Line */}
                        <Line
                            data={historyData}
                            type="monotone"
                            dataKey="price"
                            stroke="#00FF7F"
                            strokeWidth={3}
                            dot={{ r: 4, fill: '#1A1B23', stroke: '#00FF7F', strokeWidth: 2 }}
                            activeDot={{ r: 6, fill: '#00FF7F', stroke: '#fff', strokeWidth: 2 }}
                            isAnimationActive={false}
                        />

                        {/* Forecast Line */}
                        <Line
                            data={connectedForecastData}
                            type="monotone"
                            dataKey="price"
                            stroke="#00FF7F"
                            strokeWidth={3}
                            strokeDasharray="5 5"
                            dot={{ r: 4, fill: '#1A1B23', stroke: '#00FF7F', strokeWidth: 2 }}
                            activeDot={{ r: 6, fill: '#amber-400', stroke: '#fff', strokeWidth: 2 }}
                            isAnimationActive={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default MandiForecasting;
