import { useState, useEffect } from 'react';
import { CloudRain, Sun, Cloud, Wind, Droplets, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface WeatherDay {
    date: string;
    icon: string;
    tempMax: number;
    tempMin: number;
    rainProb: number;
    humidity: number;
    windSpeed: number;
    windDir: string;
    isToday: boolean;
}

interface AgriWeatherProps {
    labels?: any;
}

export default function AgriWeather({ labels }: AgriWeatherProps = {}) {
    // 1. Data Structure for Cascading Dropdowns
    const indiaLocations: Record<string, string[]> = {
        'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad'],
        'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Erode', 'Salem'],
        'Bihar': ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Purnia'],
        'Karnataka': ['Bengaluru', 'Mysuru', 'Hubballi', 'Mangaluru', 'Belagavi'],
        'Kerala': ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam'],
        'Telangana': ['Hyderabad', 'Warangal', 'Nizamabad', 'Khammam', 'Karimnagar'],
        'Andhra Pradesh': ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool'],
        'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar'],
        'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Agra', 'Varanasi', 'Prayagraj'],
        'West Bengal': ['Kolkata', 'Howrah', 'Darjeeling', 'Siliguri', 'Asansol'],
    };

    const states = Object.keys(indiaLocations).sort();

    // 1. State Management
    const [selectedState, setSelectedState] = useState('Tamil Nadu');
    const [selectedDistrict, setSelectedDistrict] = useState('Erode');
    const [weatherForecast, setWeatherForecast] = useState<WeatherDay[]>([]);

    // UI states
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Derived State for Available Districts
    const availableDistricts = selectedState ? indiaLocations[selectedState] || [] : [];

    // Handle State Change
    const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newState = e.target.value;
        setSelectedState(newState);

        // Reset district to the first available district in the new state
        const newDistricts = indiaLocations[newState] || [];
        setSelectedDistrict(newDistricts.length > 0 ? newDistricts[0] : '');
    };

    // Fetch Weather Data
    useEffect(() => {
        const fetchWeather = async () => {
            setLoading(true);
            setError(null);

            try {
                const response = await fetch(`/api/weather?state=${encodeURIComponent(selectedState)}&district=${encodeURIComponent(selectedDistrict)}`);

                if (!response.ok) {
                    // Fallback to mock data if the endpoint isn't ready yet
                    generateMockData();
                    return;
                }

                const data = await response.json();
                setWeatherForecast(data);
            } catch (err) {
                console.error("Error fetching weather:", err);
                // Fallback to mock data for demonstration purposes if backend fails
                generateMockData();
            } finally {
                setLoading(false);
            }
        };

        fetchWeather();
    }, [selectedDistrict, selectedState]);

    // Temporary helper to generate mock data matching the screenshot if backend fails
    const generateMockData = () => {
        const mock: WeatherDay[] = [
            { date: 'Today, 21 Feb', icon: 'rain', tempMax: 32, tempMin: 22, rainProb: 70, humidity: 85, windSpeed: 18, windDir: 'NW', isToday: true },
            { date: 'Tomorrow, 22 Feb', icon: 'cloud', tempMax: 32, tempMin: 22, rainProb: 70, humidity: 85, windSpeed: 18, windDir: 'NW', isToday: false },
            { date: 'Mon, 23 Feb', icon: 'sun', tempMax: 32, tempMin: 22, rainProb: 70, humidity: 85, windSpeed: 18, windDir: 'NW', isToday: false },
            { date: 'Tue, 24 Feb', icon: 'partly-cloudy', tempMax: 32, tempMin: 22, rainProb: 70, humidity: 85, windSpeed: 18, windDir: 'NW', isToday: false },
            { date: 'Wed, 25 Feb', icon: 'partly-cloudy', tempMax: 32, tempMin: 22, rainProb: 70, humidity: 85, windSpeed: 18, windDir: 'NW', isToday: false }
        ];

        // Slightly randomize mock data for visual variance in charts
        const randomized = mock.map(day => ({
            ...day,
            rainProb: Math.floor(Math.random() * 60) + 20,
            windSpeed: Math.floor(Math.random() * 20) + 5
        }));

        // Force the first card to be > 15 wind speed for the active Avoid Spraying test
        randomized[0].windSpeed = 18;

        setWeatherForecast(randomized);
    };

    const renderWeatherIcon = (iconType: string) => {
        switch (iconType) {
            case 'sun': return <Sun className="w-12 h-12 text-yellow-400" fill="currentColor" />;
            case 'cloud': return <Cloud className="w-12 h-12 text-gray-400" fill="currentColor" />;
            case 'partly-cloudy': return (
                <div className="relative w-12 h-12">
                    <Sun className="w-8 h-8 text-yellow-400 absolute top-0 right-0" fill="currentColor" />
                    <Cloud className="w-10 h-10 text-gray-300 absolute bottom-0 left-0" fill="currentColor" />
                </div>
            );
            case 'rain': return (
                <div className="relative w-12 h-12 flex flex-col items-center">
                    <CloudRain className="w-10 h-10 text-blue-400" fill="currentColor" />
                </div>
            );
            default: return <Sun className="w-12 h-12 text-yellow-400" fill="currentColor" />;
        }
    };

    return (
        <div className="flex flex-col w-full bg-[#111318] rounded-3xl p-6 md:p-8 animate-fade-in relative overflow-hidden shadow-2xl border border-white/5 h-auto min-h-fit">
            {/* Background Gradient Effect */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#00FF7F]/5 rounded-full blur-[120px] pointer-events-none -translate-y-1/2 translate-x-1/2" />

            {/* 2. Header & Selection UI */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-8 relative z-10 gap-6">
                <div>
                    <h2 className="text-3xl font-bold text-[#00FF7F] mb-2 tracking-tight">{labels?.weatherAgriWeather || 'Hyper-Local Agri-Weather'}</h2>
                    <p className="text-gray-300 flex items-center gap-2">
                        Location: <span className="text-white font-medium">{selectedDistrict}, {selectedState}</span>
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                    <div className="flex flex-col gap-1 w-full sm:w-48">
                        <label className="text-xs text-gray-400 ml-1">{labels?.selectState || 'Select State'}</label>
                        <select
                            value={selectedState}
                            onChange={handleStateChange}
                            className="bg-[#1A1C23] border border-[#00FF7F]/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#00FF7F] transition-colors appearance-none shadow-[0_0_15px_rgba(0,255,127,0.1)]"
                        >
                            {states.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-col gap-1 w-full sm:w-48">
                        <label className="text-xs text-gray-400 ml-1">{labels?.selectDistrict || 'Select District'}</label>
                        <select
                            value={selectedDistrict}
                            onChange={(e) => setSelectedDistrict(e.target.value)}
                            disabled={!selectedState || availableDistricts.length === 0}
                            className="bg-[#1A1C23] border border-[#00FF7F]/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#00FF7F] transition-colors appearance-none shadow-[0_0_15px_rgba(0,255,127,0.1)] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {availableDistricts.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {error ? (
                <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
                    <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
                    <p className="text-gray-400">{error}</p>
                </div>
            ) : (
                <>
                    {/* 3. 5-Day Forecast Cards */}
                    <div className="flex flex-row items-stretch gap-4 mb-4 md:mb-10 relative z-10 overflow-x-auto pb-4 shrink-0 min-h-[320px] snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        {/* Connecting Line behind the cards */}
                        <div className="hidden md:block absolute top-[50%] left-0 right-0 h-[2px] bg-[#00FF7F]/30 -z-10" />

                        {loading && weatherForecast.length === 0 ? (
                            Array.from({ length: 5 }).map((_, idx) => (
                                <div
                                    key={`skeleton-${idx}`}
                                    className="flex flex-col justify-between bg-[#1A1C23]/80 backdrop-blur-md rounded-2xl p-4 min-w-[280px] sm:min-w-[170px] lg:min-w-[180px] flex-1 border border-white/5 animate-pulse snap-center"
                                    style={{ minHeight: '300px' }}
                                >
                                    <h4 className="h-4 bg-white/10 rounded w-1/2 mx-auto mb-4"></h4>

                                    <div className="flex flex-col flex-1 justify-center">
                                        <div className="w-12 h-12 bg-white/10 rounded-full mx-auto mb-6"></div>
                                        <div className="h-3 bg-white/10 rounded w-3/4 mx-auto mb-4"></div>

                                        <div className="mb-6">
                                            <div className="h-6 bg-white/10 rounded-full w-full mx-auto"></div>
                                        </div>

                                        <div className="flex justify-between items-start w-full mb-6">
                                            <div className="h-8 bg-white/10 rounded w-[45%]"></div>
                                            <div className="h-8 bg-white/10 rounded w-[45%]"></div>
                                        </div>
                                    </div>

                                    <div className="mt-auto text-center pt-3 border-t border-white/10">
                                        <div className="h-6 bg-white/10 rounded w-3/4 mx-auto"></div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            weatherForecast.map((day, idx) => (
                                <div
                                    key={idx}
                                    className={`flex flex-col justify-between bg-[#1A1C23]/80 backdrop-blur-md rounded-2xl p-4 min-w-[280px] sm:min-w-[170px] lg:min-w-[180px] flex-1 transition-all hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)] snap-center ${day.isToday || idx === 0
                                        ? 'border-2 border-[#00FF7F] shadow-[0_0_20px_rgba(0,255,127,0.15)] relative scale-105 md:scale-100 z-10'
                                        : 'border border-white/5'
                                        }`}
                                    style={{ minHeight: '300px' }}
                                >
                                    <h4 className="text-center text-gray-200 font-medium mb-4">{day.date}</h4>

                                    <div className="flex flex-col flex-1 justify-center">
                                        <div className="flex justify-center mb-6">
                                            {renderWeatherIcon(day.icon)}
                                        </div>

                                        <p className="text-center text-sm text-gray-300 font-medium mb-4">
                                            Max: {day.tempMax}°C <span className="text-gray-500">/</span> Min: {day.tempMin}°C
                                        </p>

                                        {/* Rain Probability Bar */}
                                        <div className="mb-6">
                                            <div className="h-6 w-full bg-black/40 rounded-full overflow-hidden relative border border-white/5 flex items-center justify-center">
                                                <div
                                                    className="absolute top-0 left-0 h-full bg-[#00FF7F] transition-all duration-1000 ease-out"
                                                    style={{ width: `${day.rainProb}%` }}
                                                />
                                                <span className={`relative text-xs font-bold z-10 ${day.rainProb >= 50 ? 'text-black' : 'text-gray-300'}`}>
                                                    Rain Probability: {day.rainProb}%
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-start text-xs text-gray-400 mb-6">
                                            <div className="flex flex-col items-center flex-1">
                                                <Droplets className="w-4 h-4 mb-1 text-blue-400" />
                                                <span>Humidity:</span>
                                                <span className="font-bold text-white text-sm">{day.humidity}%</span>
                                            </div>
                                            <div className="flex flex-col items-center flex-1">
                                                <Wind className="w-4 h-4 mb-1 text-gray-300" />
                                                <span>Wind: {day.windSpeed} km/h</span>
                                                <span>{day.windDir}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Agricultural Advice Logic */}
                                    <div className="mt-auto text-center pt-3 border-t border-white/10">
                                        {day.windSpeed > 15 ? (
                                            <span className="text-xs font-bold text-amber-400">
                                                High Wind - Delay Spraying
                                                <br />
                                                <span className="text-[10px] opacity-80">(Avoid Spraying)</span>
                                            </span>
                                        ) : (
                                            <span className="text-xs font-bold text-[#00FF7F]">
                                                Optimal Irrigation
                                                <br />
                                                <span className="text-[10px] opacity-80">(Optimal Conditions)</span>
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* 4. Trend Charts Section */}
                    {(!loading || weatherForecast.length > 0) && (
                        <div className="w-full flex-1 min-h-[200px] relative z-10 glass-panel p-4 rounded-3xl border border-white/5 overflow-hidden min-w-0">
                            <div className="flex justify-between items-center mb-2 px-2">
                                <span className="text-sm font-medium text-gray-300">Wind Speed Trend</span>
                                <span className="text-sm font-medium text-gray-300">Rainfall Trend</span>
                            </div>

                            <ResponsiveContainer width="100%" height={200}>
                                <AreaChart data={weatherForecast} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorWind" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#00FF7F" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#00FF7F" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorRain" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="date" hide />
                                    <YAxis
                                        orientation="right"
                                        tick={{ fill: '#9CA3AF', fontSize: 12 }}
                                        axisLine={false}
                                        tickLine={false}
                                        tickFormatter={(val) => `${val}`}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1A1C23', borderColor: '#ffffff20', borderRadius: '12px' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="windSpeed"
                                        name="Wind Speed (km/h)"
                                        stroke="#00FF7F"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorWind)"
                                        activeDot={{ r: 6, fill: '#00FF7F', stroke: '#111318', strokeWidth: 2 }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="rainProb"
                                        name="Rain Probability (%)"
                                        stroke="#3B82F6"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorRain)"
                                        activeDot={{ r: 6, fill: '#3B82F6', stroke: '#111318', strokeWidth: 2 }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
