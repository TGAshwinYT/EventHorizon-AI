import { useState, useEffect } from 'react';
import { Sun, Cloud, CloudRain, CloudLightning, Wind, Droplets, Thermometer, Eye, Sunrise, Sunset, Gauge, ShieldAlert, Car, Flower2, Dumbbell, Bus, Palmtree, Bug, Loader2, AlertCircle } from 'lucide-react';

interface MobileWeatherForecastProps {
    state: string;
    district: string;
}

interface WeatherData {
    location: string;
    current: {
        temp: number;
        condition: string;
        tempMax: number;
        tempMin: number;
        aqi: number;
        aqiLabel: string;
        feelsLike: number;
        humidity: number;
        windSpeed: number;
        windDir: string;
        pressure: number;
        visibility: number;
        sunrise: string;
        sunset: string;
        uvIndex: number;
    };
    hourly: Array<{
        time: string;
        temp: number;
        icon: string;
    }>;
    daily: Array<{
        date: string;
        day: string;
        tempMax: number;
        tempMin: number;
        icon: string;
    }>;
    aiInsights: {
        agriAdvice: string;
        simulationInsight: string;
        modelSource: string;
    };
}

const MobileWeatherForecast = ({ state, district }: MobileWeatherForecastProps) => {
    const [data, setData] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`/api/weather/detailed?state=${encodeURIComponent(state)}&district=${encodeURIComponent(district)}`);
                if (!response.ok) throw new Error("Failed to fetch weather data");
                const jsonData = await response.json();
                setData(jsonData);
            } catch (err) {
                console.error("Weather fetch error:", err);
                setError("Unable to load weather for this location.");
            } finally {
                setLoading(false);
            }
        };

        if (state && district) {
            fetchData();
        }
    }, [state, district]);

    const renderIcon = (type: string, size = 24) => {
        const iconClass = `w-${size / 4} h-${size / 4}`;
        switch (type) {
            case 'sun': return <Sun className={`${iconClass} text-yellow-400`} fill="currentColor" />;
            case 'cloudy': return <Cloud className={`${iconClass} text-gray-400`} fill="currentColor" />;
            case 'storm': return <CloudLightning className={`${iconClass} text-gray-400`} fill="currentColor" />;
            case 'rain': return <CloudRain className={`${iconClass} text-blue-400`} fill="currentColor" />;
            default: return <Sun className={`${iconClass} text-yellow-400`} fill="currentColor" />;
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                <p className="text-gray-400 animate-pulse text-sm">Gathering hyper-local weather data...</p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-6">
                <AlertCircle className="w-12 h-12 text-red-500/50" />
                <p className="text-gray-400 text-sm">{error || "Select a location to see weather forecast."}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 pb-20 animate-fade-in">
            {/* Main Location & Temp */}
            <div className="flex flex-col items-center py-8">
                <h1 className="text-2xl font-medium mb-1">{data.location}</h1>
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-[10px] text-blue-400 uppercase tracking-widest font-bold">Live AI Forecast</span>
                </div>
                <div className="text-8xl font-light mb-2 relative">
                    {data.current.temp}
                    <span className="text-4xl absolute top-4 -right-8">°</span>
                </div>
                <div className="text-lg text-gray-300 mb-1">{data.current.condition}</div>
                <div className="text-gray-400 flex gap-2">
                    <span>{data.current.tempMin}° / {data.current.tempMax}°</span>
                    <span>•</span>
                    <span className="text-emerald-400">AQI: {data.current.aqiLabel}</span>
                </div>
            </div>

            {/* AI Agricultural Insight Banner */}
            <div className="bg-emerald-600/20 backdrop-blur-md rounded-2xl p-4 flex items-center gap-3 border border-emerald-500/30">
                <div className="p-2 bg-emerald-500/20 rounded-full">
                    <ShieldAlert className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex flex-col">
                    <span className="text-xs text-emerald-400 font-bold uppercase tracking-tight">Agri-Advisor AI</span>
                    <span className="text-sm font-medium">{data.aiInsights.agriAdvice}</span>
                </div>
            </div>

            {/* Simulation Insight Panel (FourCastNet) */}
            <div className="bg-blue-600/20 backdrop-blur-md rounded-2xl p-4 flex items-center gap-3 border border-blue-500/30">
                <div className="p-2 bg-blue-500/20 rounded-full">
                    <Gauge className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-blue-400 font-bold uppercase tracking-tight">FourCastNet Simulation</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    </div>
                    <span className="text-sm font-medium italic">"{data.aiInsights.simulationInsight}"</span>
                    <span className="text-[9px] text-blue-300 mt-1 uppercase tracking-widest font-bold">Powered by NVIDIA Earth-2</span>
                </div>
            </div>

            {/* Hourly Forecast */}
            <div className="bg-[#1e293b]/50 backdrop-blur-md rounded-2xl p-5 border border-white/5">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Next 24 Hours</h3>
                <div className="flex overflow-x-auto gap-8 no-scrollbar pb-2">
                    {data.hourly.map((h, i) => (
                        <div key={i} className="flex flex-col items-center gap-4 min-w-fit">
                            <span className="text-sm text-gray-400 whitespace-nowrap">{h.time}</span>
                            <div className="w-8 h-8 flex items-center justify-center">
                                {renderIcon(h.icon, 32)}
                            </div>
                            <span className="text-lg font-medium">{h.temp}°</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Daily Forecast List */}
            <div className="bg-[#1e293b]/50 backdrop-blur-md rounded-2xl p-5 border border-white/5">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">7-Day Forecast</h3>
                <div className="flex flex-col gap-6">
                    {data.daily.map((d, i) => (
                        <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-4 w-24">
                                <span className="text-gray-400 text-sm font-medium">{d.date}</span>
                                <span className="text-sm font-medium">{d.day}</span>
                            </div>
                            <div className="flex-1 flex justify-center">
                                {renderIcon(d.icon, 28)}
                            </div>
                            <div className="flex items-center gap-3 w-20 justify-end">
                                <span className="text-sm font-medium">{d.tempMin}°</span>
                                <span className="text-gray-500">/</span>
                                <span className="text-sm font-medium">{d.tempMax}°</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Air Quality Detail */}
            <div className="bg-[#1e293b]/50 backdrop-blur-md rounded-2xl p-5 border border-white/5 relative">
                <div className="flex justify-between items-center mb-4">
                    <span className="text-sm text-gray-400">Air quality index</span>
                </div>
                <div className="text-2xl font-bold mb-1">{data.current.aqiLabel} ({data.current.aqi})</div>
                <p className="text-sm text-gray-400 leading-tight mb-6">
                    {data.current.aqi < 50 ? "Air quality is considered satisfactory, and air pollution poses little or no risk." : "Sensitive groups should reduce outdoor activity."}
                </p>
                <div className="h-1.5 w-full bg-gradient-to-r from-green-500 via-yellow-500 via-orange-500 via-red-500 to-purple-600 rounded-full relative">
                    <div 
                        className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-black rounded-full transition-all duration-1000" 
                        style={{ left: `${Math.min(data.current.aqi, 100)}%` }}
                    />
                </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4">
                {/* UV Index */}
                <div className="bg-[#1e293b]/50 backdrop-blur-md rounded-2xl p-5 border border-white/5 flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-gray-400">
                        <Sun className="w-4 h-4" />
                        <span className="text-xs uppercase font-bold tracking-wider">UV Index</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-2xl font-bold">{data.current.uvIndex}</span>
                        <span className="text-sm text-gray-300">
                            {data.current.uvIndex >= 11 ? "Extreme" : 
                             data.current.uvIndex >= 8 ? "Very high" : 
                             data.current.uvIndex >= 6 ? "High" : 
                             data.current.uvIndex >= 3 ? "Moderate" : "Low"}
                        </span>
                    </div>
                </div>

                {/* Feels Like */}
                <div className="bg-[#1e293b]/50 backdrop-blur-md rounded-2xl p-5 border border-white/5 flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-gray-400">
                        <Thermometer className="w-4 h-4" />
                        <span className="text-xs uppercase font-bold tracking-wider">Feels like</span>
                    </div>
                    <div className="text-2xl font-bold">{data.current.feelsLike} °</div>
                </div>

                {/* Humidity */}
                <div className="bg-[#1e293b]/50 backdrop-blur-md rounded-2xl p-5 border border-white/5 flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-gray-400">
                        <Droplets className="w-4 h-4" />
                        <span className="text-xs uppercase font-bold tracking-wider">Humidity</span>
                    </div>
                    <div className="text-2xl font-bold">{data.current.humidity} <span className="text-sm font-normal text-gray-400">%</span></div>
                </div>

                {/* Wind */}
                <div className="bg-[#1e293b]/50 backdrop-blur-md rounded-2xl p-5 border border-white/5 flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-gray-400">
                        <Wind className="w-4 h-4" />
                        <span className="text-xs uppercase font-bold tracking-wider">{data.current.windDir} wind</span>
                    </div>
                    <div className="text-2xl font-bold">{data.current.windSpeed} <span className="text-sm font-normal text-gray-400">km/h</span></div>
                </div>

                {/* Pressure */}
                <div className="bg-[#1e293b]/50 backdrop-blur-md rounded-2xl p-5 border border-white/5 flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-gray-400">
                        <Gauge className="w-4 h-4" />
                        <span className="text-xs uppercase font-bold tracking-wider">Pressure</span>
                    </div>
                    <div className="text-2xl font-bold">{data.current.pressure} <span className="text-sm font-normal text-gray-400">hPa</span></div>
                </div>

                {/* Visibility */}
                <div className="bg-[#1e293b]/50 backdrop-blur-md rounded-2xl p-5 border border-white/5 flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-gray-400">
                        <Eye className="w-4 h-4" />
                        <span className="text-xs uppercase font-bold tracking-wider">Visibility</span>
                    </div>
                    <div className="text-2xl font-bold">{data.current.visibility} <span className="text-sm font-normal text-gray-400">km</span></div>
                </div>
            </div>

            {/* Sunrise & Sunset */}
            <div className="bg-[#1e293b]/50 backdrop-blur-md rounded-2xl p-5 border border-white/5">
                <div className="flex justify-between items-center mb-8">
                    <div className="flex flex-col gap-1">
                        <Sunrise className="w-5 h-5 text-gray-400" />
                        <span className="text-xs text-gray-400">Sunrise</span>
                        <span className="text-lg font-bold">{data.current.sunrise}</span>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                        <Sunset className="w-5 h-5 text-gray-400" />
                        <span className="text-xs text-gray-400">Sunset</span>
                        <span className="text-lg font-bold">{data.current.sunset}</span>
                    </div>
                </div>
                
                {/* Progress Bar */}
                <div className="h-1 w-full bg-white/10 rounded-full mb-2 relative">
                    <div className="absolute top-1/2 -translate-y-1/2 left-[60%] w-3 h-3 bg-yellow-400 rounded-full shadow-[0_0_10px_#facc15]" />
                </div>
            </div>

            {/* Lifestyle Tips (AI Driven) */}
            <div className="bg-[#1e293b]/50 backdrop-blur-md rounded-2xl p-5 border border-white/5">
                <div className="flex justify-between items-center mb-8">
                    <span className="text-sm text-gray-400">AI Lifestyle Tips</span>
                </div>

                <div className="grid grid-cols-3 gap-y-10">
                    <div className={`flex flex-col items-center text-center gap-2 ${data.current.uvIndex > 5 ? 'opacity-100' : 'opacity-40'}`}>
                        <ShieldAlert className="w-6 h-6 text-white" />
                        <span className="text-[10px] text-gray-300 leading-tight">High UV index</span>
                    </div>
                    <div className={`flex flex-col items-center text-center gap-2 ${data.current.windSpeed < 20 ? 'opacity-100' : 'opacity-40'}`}>
                        <Car className="w-6 h-6 text-white" />
                        <span className="text-[10px] text-gray-300 leading-tight">Good car wash</span>
                    </div>
                    <div className={`flex flex-col items-center text-center gap-2 ${data.current.temp < 35 ? 'opacity-100' : 'opacity-40'}`}>
                        <Dumbbell className="w-6 h-6 text-white" />
                        <span className="text-[10px] text-gray-300 leading-tight">Outdoor workout</span>
                    </div>
                    <div className={`flex flex-col items-center text-center gap-2 ${data.current.condition.toLowerCase().includes('rain') ? 'opacity-40' : 'opacity-100'}`}>
                        <Palmtree className="w-6 h-6 text-white" />
                        <span className="text-[10px] text-gray-300 leading-tight">Good for trip</span>
                    </div>
                    <div className={`flex flex-col items-center text-center gap-2 ${data.current.humidity > 70 ? 'opacity-100' : 'opacity-40'}`}>
                        <Bug className="w-6 h-6 text-white" />
                        <span className="text-[10px] text-gray-300 leading-tight">Mosquito alert</span>
                    </div>
                    <div className="flex flex-col items-center text-center gap-2">
                        <Flower2 className="w-6 h-6 text-white" />
                        <span className="text-[10px] text-gray-300 leading-tight">Fertilize plants</span>
                    </div>
                </div>
            </div>

            <div className="text-center py-8 text-gray-500 text-xs font-medium uppercase tracking-widest">
                Real-Time Weather Data via EventHorizon AI
            </div>
        </div>
    );
};

export default MobileWeatherForecast;
