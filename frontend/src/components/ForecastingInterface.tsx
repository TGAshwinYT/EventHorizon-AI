import { useState, useEffect } from 'react';
import { CloudRain, TrendingUp, Search } from 'lucide-react';
import MandiForecasting from './MandiForecasting';
import AgriWeather from './AgriWeather';

interface ForecastingInterfaceProps {
    currentLanguage: string;
    labels?: any;
}

const ForecastingInterface = ({ labels }: ForecastingInterfaceProps) => {
    const [activeTab, setActiveTab] = useState<'mandi' | 'weather'>('mandi');

    // Selection State
    const [crop, setCrop] = useState('Tomato');
    const [state, setState] = useState('Maharashtra');
    const [district, setDistrict] = useState('All Districts');
    const [availableDistricts, setAvailableDistricts] = useState<string[]>(['All Districts']);
    const [loadingDistricts, setLoadingDistricts] = useState(false);

    // The actually submitted values for the chart to fetch
    const [submittedCrop, setSubmittedCrop] = useState('Tomato');
    const [submittedState, setSubmittedState] = useState('Maharashtra');

    const crops = [
        'Tomato', 'Onion', 'Potato', 'Rice', 'Wheat', 'Cotton', 'Sugarcane',
        'Brinjal', 'Cabbage', 'Cauliflower', 'Carrot', 'Bhindi(Ladies Finger)', 'Green Chilli',
        'Apple', 'Banana', 'Mango', 'Pomegranate', 'Grapes'
    ];

    const states = [
        'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
        'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra',
        'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim',
        'Tamil Nadu', ' तेलंगाना', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
        'Andaman and Nicobar Islands', 'Chandigarh', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
    ];

    useEffect(() => {
        const fetchDistricts = async () => {
            setLoadingDistricts(true);
            try {
                const res = await fetch(`/api/market/districts?crop=${encodeURIComponent(crop)}&state=${encodeURIComponent(state)}`);
                if (res.ok) {
                    const dat = await res.json();
                    const fetchedDistricts = ['All Districts', ...dat.districts];
                    setAvailableDistricts(fetchedDistricts);
                    if (!fetchedDistricts.includes(district)) {
                        setDistrict('All Districts');
                    }
                } else {
                    setAvailableDistricts(['All Districts']);
                    setDistrict('All Districts');
                }
            } catch (error) {
                console.error("Failed to fetch districts");
                setAvailableDistricts(['All Districts']);
                setDistrict('All Districts');
            } finally {
                setLoadingDistricts(false);
            }
        };
        fetchDistricts();
    }, [crop, state]);

    const handleSearch = () => {
        setSubmittedCrop(crop);
        setSubmittedState(state);
    };

    return (
        <div className="flex flex-col h-full overflow-y-auto custom-scrollbar p-0 animate-fade-in text-white min-w-0">

            {/* Sub-tabs for Forecasting */}
            <div className="flex bg-black/20 p-1 rounded-2xl border border-white/5 mb-6 w-full max-w-2xl mx-auto">
                <button
                    onClick={() => setActiveTab('mandi')}
                    className={`flex-1 flex flex-col md:flex-row items-center justify-center gap-2 py-3 px-4 text-center rounded-xl font-medium transition-all ${activeTab === 'mandi'
                        ? 'bg-purple-600 shadow-lg shadow-purple-900/20 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                >
                    <TrendingUp className="w-5 h-5 shrink-0" />
                    <span>{labels?.mandiPricePrediction || 'Mandi Price Prediction'}</span>
                </button>
                <button
                    onClick={() => setActiveTab('weather')}
                    className={`flex-1 flex flex-col md:flex-row items-center justify-center gap-2 py-3 px-4 text-center rounded-xl font-medium transition-all ${activeTab === 'weather'
                        ? 'bg-blue-600 shadow-lg shadow-blue-900/20 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                >
                    <CloudRain className="w-5 h-5 shrink-0" />
                    <span>{labels?.weatherAgriWeather || 'Hyper-Local Agri-Weather'}</span>
                </button>
            </div>

            {activeTab === 'mandi' ? (
                <div className="space-y-6">
                    {/* Selection Panel */}
                    <div className="glass-panel p-6 rounded-3xl space-y-6 border-white/10">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm text-gray-400">{labels?.selectCrop || 'Select Crop'}</label>
                                <select
                                    value={crop}
                                    onChange={(e) => setCrop(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500 transition-colors appearance-none"
                                >
                                    {crops.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm text-gray-400">{labels?.selectState || 'Select State'}</label>
                                <select
                                    value={state}
                                    onChange={(e) => setState(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500 transition-colors appearance-none"
                                >
                                    {states.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm text-gray-400">{labels?.selectDistrict || 'Select District'}</label>
                                <select
                                    value={district}
                                    onChange={(e) => setDistrict(e.target.value)}
                                    disabled={loadingDistricts}
                                    className={`w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500 transition-colors appearance-none ${loadingDistricts ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {availableDistricts.map(m => (
                                        <option key={m} value={m}>
                                            {m === 'All Districts' ? (labels?.allDistricts || 'All Districts') : m}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <button
                            onClick={handleSearch}
                            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-purple-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            <Search className="w-6 h-6" />
                            {labels?.getForecast || 'Get Forecast'}
                        </button>
                    </div>

                    {/* The Chart Component */}
                    <div className="animate-slide-up">
                        <MandiForecasting crop={submittedCrop} state={submittedState} labels={labels} />
                    </div>
                </div>
            ) : (
                <div className="animate-slide-up h-full">
                    <AgriWeather labels={labels} />
                </div>
            )}
        </div>
    );
};

export default ForecastingInterface;
