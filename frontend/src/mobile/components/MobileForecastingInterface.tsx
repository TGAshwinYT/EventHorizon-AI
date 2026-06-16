import { useState, useEffect } from 'react';
import { CloudRain, TrendingUp, Search, MapPin } from 'lucide-react';
import MobileMandiForecasting from './MobileMandiForecasting';
import MobileWeatherForecast from './MobileWeatherForecast';
import CustomSelect from '../../components/CustomSelect';
import { useUserStore } from '../../store/userStore';
import { DISTRICT_PLACES } from '../../utils/locationData';

interface ForecastingInterfaceProps {
    labels?: any;
}

const MobileForecastingInterface = ({ labels }: ForecastingInterfaceProps) => {
    const [activeTab, setActiveTab] = useState<'mandi' | 'weather'>('mandi');
    const profile = useUserStore((s) => s.profile);

    // Selection State
    const [crop, setCrop] = useState('Tomato');
    const [state, setState] = useState(profile?.state || 'Tamil Nadu');
    const [district, setDistrict] = useState(profile?.district || '');
    const [place, setPlace] = useState(profile?.mandal || '');
    const [isCustomPlace, setIsCustomPlace] = useState(false);
    const [availableDistricts, setAvailableDistricts] = useState<string[]>([]);
    const [loadingDistricts, setLoadingDistricts] = useState(false);

    // The actually submitted values for the chart to fetch
    const [submittedCrop, setSubmittedCrop] = useState('Tomato');
    const [submittedState, setSubmittedState] = useState('Tamil Nadu');

    const crops = [
        'Tomato', 'Onion', 'Potato', 'Rice', 'Wheat', 'Cotton', 'Sugarcane',
        'Brinjal', 'Cabbage', 'Cauliflower', 'Carrot', 'Bhindi(Ladies Finger)', 'Green Chilli',
        'Apple', 'Banana', 'Mango', 'Pomegranate', 'Grapes'
    ];

    const states = [
        'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
        'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra',
        'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim',
        'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
        'Andaman and Nicobar Islands', 'Chandigarh', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
    ];

    useEffect(() => {
        const fetchDistricts = async () => {
            setLoadingDistricts(true);
            try {
                const res = await fetch(`/api/market/districts?crop=${encodeURIComponent(crop)}&state=${encodeURIComponent(state)}`);
                if (res.ok) {
                    const dat = await res.json();
                    const fetchedDistricts = dat.districts;
                    setAvailableDistricts(fetchedDistricts);
                    if (fetchedDistricts.length > 0 && !fetchedDistricts.includes(district)) {
                        setDistrict(fetchedDistricts[0]);
                    }
                }
            } catch (error) {
                console.error("Failed to fetch districts");
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
        <div className="flex flex-col h-full animate-fade-in text-white min-w-0">
            {/* Sub-tabs for Forecasting */}
            <div className="flex bg-black/40 p-1 rounded-2xl border border-white/10 mb-6 shrink-0">
                <button
                    onClick={() => setActiveTab('mandi')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all ${activeTab === 'mandi'
                        ? 'bg-emerald-600 shadow-lg shadow-emerald-900/20 text-white'
                        : 'text-gray-400'
                        }`}
                >
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-sm">Price</span>
                </button>
                <button
                    onClick={() => setActiveTab('weather')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all ${activeTab === 'weather'
                        ? 'bg-blue-600 shadow-lg shadow-blue-900/20 text-white'
                        : 'text-gray-400'
                        }`}
                >
                    <CloudRain className="w-4 h-4" />
                    <span className="text-sm">Weather</span>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar pb-20">
                <div className="space-y-6 animate-slide-up">
                    {/* Selection Panel - Shared between Mandi and Weather */}
                    <div className="glass-panel p-4 rounded-2xl space-y-4 border-white/10 bg-white/5">
                        <div className="space-y-4">
                            {activeTab === 'mandi' && (
                                <CustomSelect
                                    label="Select Crop"
                                    value={crop}
                                    onChange={setCrop}
                                    options={crops}
                                    accentColor="emerald"
                                />
                            )}
                            <CustomSelect
                                label="Select State"
                                value={state}
                                onChange={(val) => {
                                    setState(val);
                                    setDistrict('');
                                    setPlace('');
                                    setIsCustomPlace(false);
                                }}
                                options={states}
                                accentColor={activeTab === 'mandi' ? 'emerald' : 'blue'}
                            />
                            <CustomSelect
                                label="Select District"
                                value={district}
                                onChange={(val) => {
                                    setDistrict(val);
                                    setPlace('');
                                    setIsCustomPlace(false);
                                }}
                                options={availableDistricts}
                                disabled={loadingDistricts}
                                accentColor={activeTab === 'mandi' ? 'emerald' : 'blue'}
                            />
                            {/* Place / Town / Mandal — only shown in Weather tab */}
                            {activeTab === 'weather' && (
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs text-gray-400 font-medium ml-1">
                                        <MapPin className="w-3 h-3 inline mr-1" />
                                        Place / Town / Mandal
                                    </label>
                                    {!isCustomPlace && district && DISTRICT_PLACES[district] ? (
                                        <select
                                            value={place}
                                            onChange={(e) => {
                                                if (e.target.value === '__custom__') {
                                                    setIsCustomPlace(true);
                                                    setPlace('');
                                                } else {
                                                    setPlace(e.target.value);
                                                }
                                            }}
                                            disabled={!district}
                                            className="bg-[#1A1C23] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition-all cursor-pointer w-full"
                                        >
                                            <option value="" className="bg-[#1A1C23] text-gray-400">
                                                {district ? 'Select Place' : 'Select District first'}
                                            </option>
                                            {(DISTRICT_PLACES[district] || []).map((p) => (
                                                <option key={p} value={p} className="bg-[#1A1C23] text-white">{p}</option>
                                            ))}
                                            <option value="__custom__" className="bg-[#1A1C23] text-blue-400 font-bold">
                                                Other (Type custom place...)
                                            </option>
                                        </select>
                                    ) : (
                                        <div className="relative w-full">
                                            <input
                                                type="text"
                                                value={place}
                                                onChange={(e) => setPlace(e.target.value)}
                                                placeholder="e.g. Sathyamangalam"
                                                className="w-full bg-[#1A1C23] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition-all pr-16"
                                            />
                                            {isCustomPlace && district && DISTRICT_PLACES[district] && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsCustomPlace(false);
                                                        setPlace('');
                                                    }}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-400 hover:underline"
                                                >
                                                    List
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleSearch}
                            className={`w-full text-white font-bold py-3.5 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${activeTab === 'mandi' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-900/20'}`}
                        >
                            <Search className="w-5 h-5" />
                            {activeTab === 'mandi' ? 'Get Price Forecast' : 'Update Weather'}
                        </button>
                    </div>

                    {activeTab === 'mandi' ? (
                        <div className="glass-panel p-4 rounded-2xl border-white/10 bg-white/5">
                            <MobileMandiForecasting crop={submittedCrop} state={submittedState} labels={labels} />
                        </div>
                    ) : (
                        <MobileWeatherForecast state={state} district={district} place={place} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default MobileForecastingInterface;
