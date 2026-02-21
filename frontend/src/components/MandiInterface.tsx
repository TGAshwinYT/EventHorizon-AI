import { useState, useEffect } from 'react';
import { Search, Calendar, Loader2 } from 'lucide-react';
import PriceHistoryChart from './PriceHistoryChart';

interface MandiInterfaceProps {
    currentLanguage: string;
}

const MandiInterface = ({ currentLanguage }: MandiInterfaceProps) => {
    const [crop, setCrop] = useState('Tomato');
    const [state, setState] = useState('Tamil Nadu');
    const [district, setDistrict] = useState('All Districts');
    const [availableDistricts, setAvailableDistricts] = useState<string[]>(['All Districts']);
    const [loadingDistricts, setLoadingDistricts] = useState(false);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any>(null);

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
                }
            } catch (error) {
                console.error("Failed to fetch districts");
            } finally {
                setLoadingDistricts(false);
            }
        };
        fetchDistricts();
    }, [crop, state]);

    const crops = [
        'Tomato', 'Onion', 'Potato', 'Rice', 'Wheat', 'Cotton', 'Sugarcane',
        'Brinjal', 'Cabbage', 'Cauliflower', 'Carrot', 'Bhindi(Ladies Finger)', 'Green Chilli',
        'Apple', 'Banana', 'Mango', 'Pomegranate', 'Grapes'
    ];
    // Reverted to full list of Indian States as requested
    const states = [
        'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
        'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra',
        'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim',
        'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
        'Andaman and Nicobar Islands', 'Chandigarh', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
    ];

    const cropTranslations: { [key: string]: { [key: string]: string } } = {
        'Tomato': { hi: 'टमाटर', ta: 'தக்காளி', gu: 'ટામેટા', bn: 'টমেটো', te: 'టమాటో', mr: 'टोमॅटो', kn: 'ಟೊಮ್ಯಾಟೊ', ml: 'തക്കാളി' },
        'Onion': { hi: 'प्याज', ta: 'வெங்காயம்', gu: 'ડુંગળી', bn: 'পেঁয়াজ', te: 'ఉల్లిపాయ', mr: 'कांदा', kn: 'ಈರುಳ್ಳಿ', ml: 'സവാള' },
        'Potato': { hi: 'आलू', ta: 'உருளைக்கிழங்கு', gu: 'બટાકા', bn: 'আলু', te: 'బంగాళాదుంప', mr: 'बटाटा', kn: 'ಆಲೂಗಡ್ಡೆ', ml: 'ಉരുളക്കിഴങ്ങ്' },
        'Rice': { hi: 'चावल', ta: 'அரிசி', gu: 'ચોખા', bn: 'চাল', te: 'బియ్యం', mr: 'तांदूळ', kn: 'ಅಕ್ಕಿ', ml: 'ಅരി' },
        'Wheat': { hi: 'गेहूं', ta: 'கோதுமை', gu: 'ઘઉં', bn: 'গম', te: 'గోధుమ', mr: 'गहू', kn: 'ಗೋಧಿ', ml: 'ಗೋതമ്പ്' },
        'Cotton': { hi: 'कपास', ta: 'பருத்தி', gu: 'કપાસ', bn: 'তুলা', te: 'పత్తి', mr: 'कापूस', kn: 'ಹತ್ತಿ', ml: 'ಪരുത്തി' },
        'Sugarcane': { hi: 'गन्ना', ta: 'கரும்பு', gu: 'શેરડી', bn: 'আખ', te: 'చెరకు', mr: 'ऊस', kn: 'ಕಬ್ಬು', ml: 'ಕരിമ്പ്' },
        'Brinjal': { hi: 'बैंगन', ta: 'கத்திரிக்காய்', gu: 'રીંગણ', bn: 'বেগুন', te: 'వంకాయ', mr: 'वांगी', kn: 'ಬದನೆಕಾಯಿ', ml: 'വഴുതന' },
        'Cabbage': { hi: 'पत्ता गोभी', ta: 'முட்டைக்கோஸ்', gu: 'કોબી', bn: 'বাঁધাকপি', te: 'కాబేజీ', mr: 'કોબી', kn: 'ಎಲೆಕೋಸು', ml: 'കാബേജ്' },
        'Cauliflower': { hi: 'फूल गोभी', ta: 'காலிஃபிளவர்', gu: 'ફૂલકોબી', bn: 'ফুলকপি', te: 'కాలిಫ್લವರ್', mr: 'फ्लावर', kn: 'ಹೂಕೋಸು', ml: 'ಕೋളിഫ്ലവർ' },
        'Carrot': { hi: 'गाजर', ta: 'கேரட்', gu: 'ગાજર', bn: 'গাজর', te: 'కాజర్', mr: 'गाजर', kn: 'ಗಜ್ಜರಿ', ml: 'ಕ್ಯಾರೆಟ್' },
        'Bhindi(Ladies Finger)': { hi: 'भिंडी', ta: 'வெண்டைக்காய்', gu: 'ભીંડા', bn: 'ঢেঁড়સ', te: 'బెండకాయ', mr: 'भेंडी', kn: 'ಬೆಂಡೆಕಾಯಿ', ml: 'വെണ്ടയ്ക്ക' },
        'Green Chilli': { hi: 'हरी मिर्च', ta: 'பச்சை மிளகாய்', gu: 'લીલા મરચાં', bn: 'কাঁচা মরিচ', te: 'పచ్చి మిరపకాయ', mr: 'हिरवी मिरची', kn: 'ಹಸಿ ಮೆಣಸಿನಕಾಯಿ', ml: 'പച്ചമുളക്' },
        'Apple': { hi: 'सेब', ta: 'ஆப்பிள்', gu: 'સફરજન', bn: 'আপেল', te: 'ఆపిల్', mr: 'सफरचंद', kn: 'ಸೇಬು', ml: 'ആപ്പിൾ' },
        'Banana': { hi: 'केला', ta: 'வாழைப்பழம்', gu: 'કેળાં', bn: 'কলা', te: 'అరటిపండు', mr: 'केळी', kn: 'ಬಾಳೆಹಣ್ಣು', ml: 'വാഴപ്പഴം' },
        'Mango': { hi: 'आम', ta: 'மாம்பழம்', gu: 'કેરી', bn: 'আম', te: 'మామిడి', mr: 'आंबा', kn: 'ಮಾವಿನ ಹಣ್ಣು', ml: 'ಮಾങ്ങ' },
        'Pomegranate': { hi: 'अनार', ta: 'மாதுளை', gu: 'દાડમ', bn: 'বেদানা', te: 'దానిమ్మ', mr: 'डाळिंब', kn: 'ದಾಳಿಂಬೆ', ml: 'ಮಾതಳനാരങ്ങ' },
        'Grapes': { hi: 'अंगूर', ta: 'திராட்சை', gu: 'દ્રાક્ષ', bn: 'আঙ্গুর', te: 'ద్రాಕ್ಷ', mr: 'द्राक्षे', kn: 'ದ್ರಾಕ್ಷಿ', ml: 'മുന്തിരി' }
    };

    const translations: { [key: string]: any } = {
        en: {
            header: "Mandi Rates",
            selectCrop: "Select Crop",
            selectState: "Select State",
            selectDistrict: "Select District",
            getPrice: "Get Price",
            todayPrice: "Today's Price",
            change: "Change",
            history: "Price History",
            recent: "Recent Prices",
            date: "Date",
            min: "Min",
            max: "Max",
            modal: "Modal"
        },
        hi: {
            header: "मंडी भाव",
            selectCrop: "फसल चुनें",
            selectState: "राज्य चुनें",
            selectDistrict: "ज़िला चुनें",
            getPrice: "भाव प्राप्त करें",
            todayPrice: "आज का भाव",
            change: "बदलाव",
            history: "भाव इतिहास",
            recent: "हाल की कीमतें",
            date: "दिनांक",
            min: "न्यूनतम",
            max: "अधिकतम",
            modal: "मॉडल"
        },
        ta: {
            header: "சந்தை நிலவரம்",
            selectCrop: "பயிர் தேர்ந்தெடு",
            selectState: "மாநிலம் தேர்ந்தெடு",
            selectDistrict: "மாவட்டத்தைத் தேர்ந்தெடு",
            getPrice: "விலை பெறு",
            todayPrice: "இன்றைய விலை",
            change: "மாற்றம்",
            history: "விலை வரலாறு",
            recent: "சமீபத்திய விலைகள்",
            date: "தேதி",
            min: "குறைந்தபட்சம்",
            max: "அதிகபட்சம்",
            modal: "சராசரி"
        },
        gu: {
            header: "મંડી ભાવ",
            selectCrop: "પાક પસંદ કરો",
            selectState: "રાજ્ય પસંદ કરો",
            selectDistrict: "જિલ્લો પસંદ કરો",
            getPrice: "ભાવ મેળવો",
            todayPrice: "આજનો ભાવ",
            change: "ફેરફાર",
            history: "ભાવ ઇતિહાસ",
            recent: "તાજેતરના ભાવ",
            date: "તારીખ",
            min: "લઘુત્તમ",
            max: "મહત્તમ",
            modal: "સરેરાશ"
        },
        bn: {
            header: "মন্ডি রেট",
            selectCrop: "ফসল নির্বাচন করুন",
            selectState: "রাজ্য নির্বাচন করুন",
            selectDistrict: "জেলা নির্বাচন করুন",
            getPrice: "দাম দেখুন",
            todayPrice: "আজকের দাম",
            change: "পরিবর্তন",
            history: "দামের ইতিহাস",
            recent: "সাম্প্রতিক দাম",
            date: "তারিখ",
            min: "সর্বনিম্ন",
            max: "সর্বোচ্চ",
            modal: "গড়"
        },
        te: {
            header: "మార్కెట్ రేట్లు",
            selectCrop: "పంటను ఎంచుకోండి",
            selectState: "రాష్ట్రాన్ని ఎంచుకోండి",
            selectDistrict: "జిల్లాను ఎంచుకోండి",
            getPrice: "ధర పొందండి",
            todayPrice: "నేటి ధర",
            change: "మార్పు",
            history: "ధర చరిత్ర",
            recent: "ఇటీవలి ధరలు",
            date: "తేదీ",
            min: "కనిష్ట",
            max: "గరిష్ట",
            modal: "సగటు"
        },
        mr: {
            header: "बाजार भाव",
            selectCrop: "पीक निवडा",
            selectState: "राज्य निवडा",
            selectDistrict: "जिल्हा निवडा",
            getPrice: "भाव मिळवा",
            todayPrice: "आजचा भाव",
            change: "बदल",
            history: "भाव इतिहास",
            recent: "अलीकडील किंमती",
            date: "दिनांक",
            min: "किमान",
            max: "कमाल",
            modal: "सरासरी"
        },
        kn: {
            header: "ಮಾರುಕಟ್ಟೆ ದರಗಳು",
            selectCrop: "ಬೆಳೆ ಆಯ್ಕೆಮಾಡಿ",
            selectState: "ರಾಜ್ಯ ಆಯ್ಕೆಮಾಡಿ",
            selectDistrict: "ಜಿಲ್ಲೆ ಆಯ್ಕೆಮಾಡಿ",
            getPrice: "ದರ ಪಡೆಯಿರಿ",
            todayPrice: "ಇಂದಿನ ದರ",
            change: "ಬದಲಾವಣೆ",
            history: "ದರ ಇತಿಹಾಸ",
            recent: "ಇತ್ತೀಚಿನ ದರಗಳು",
            date: "ದಿನಾಂಕ",
            min: "ಕನಿಷ್ಠ",
            max: "ಗರಿಷ್ಠ",
            modal: "ಸರಾಸರಿ"
        },
        ml: {
            header: "വിപണി നിരക്കുകൾ",
            selectCrop: "വിള തിരഞ്ഞെടുക്കുക",
            selectState: "സംസ്ഥാനം തിരഞ്ഞെടുക്കുക",
            selectDistrict: "ജില്ല തിരഞ്ഞെടുക്കുക",
            getPrice: "വില അറിയുക",
            todayPrice: "ഇന്നത്തെ വില",
            change: "മാറ്റം",
            history: "വില ചരിത്രം",
            recent: "സമീപകാല വിലകൾ",
            date: "തീയതി",
            min: "കുറഞ്ഞത്",
            max: "കൂടിയത്",
            modal: "ശരാശരി"
        }
    };

    const t = translations[currentLanguage] || translations['en'];

    const handleSearch = async () => {
        setLoading(true);
        try {
            // Fetch from backend
            const districtParam = district !== 'All Districts' ? `&district=${encodeURIComponent(district)}` : '';
            const response = await fetch(`/api/market/mandi?crop=${encodeURIComponent(crop)}&state=${encodeURIComponent(state)}${districtParam}`);
            if (response.ok) {
                const result = await response.json();
                setData(result);
            } else {
                console.error("Failed to fetch mandi rates");
            }
        } catch (error) {
            console.error("Error fetching rates:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full overflow-y-auto custom-scrollbar p-6 animate-fade-in text-white">

            {/* Selection Panel */}
            <div className="glass-panel p-6 rounded-3xl mb-8 space-y-6 border-white/10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm text-gray-400">{t.selectCrop} {currentLanguage !== 'en' && `/ ${translations['en'].selectCrop}`}</label>
                        <select
                            value={crop}
                            onChange={(e) => setCrop(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-green-500 transition-colors appearance-none"
                        >
                            {crops.map(c => (
                                <option key={c} value={c}>
                                    {currentLanguage === 'en' ? c : `${cropTranslations[c]?.[currentLanguage] || c} / ${c}`}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm text-gray-400">{t.selectState} {currentLanguage !== 'en' && `/ ${translations['en'].selectState}`}</label>
                        <select
                            value={state}
                            onChange={(e) => setState(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-green-500 transition-colors appearance-none"
                        >
                            {states.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm text-gray-400">{t.selectDistrict} {currentLanguage !== 'en' && `/ ${translations['en'].selectDistrict}`}</label>
                        <select
                            value={district}
                            onChange={(e) => setDistrict(e.target.value)}
                            disabled={loadingDistricts}
                            className={`w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-green-500 transition-colors appearance-none ${loadingDistricts ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {availableDistricts.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                </div>

                <button
                    onClick={handleSearch}
                    disabled={loading}
                    className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-green-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Search className="w-6 h-6" />}
                    {loading ? "Fetching..." : `${t.getPrice} ${currentLanguage !== 'en' ? `/ ${translations['en'].getPrice}` : ''}`}
                </button>
            </div>

            {/* Results */}
            {data && (
                <div className="space-y-8 animate-slide-up">
                    {/* Price Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-green-900/20 border border-green-500/30 p-6 rounded-2xl flex flex-col items-center justify-center text-center">
                            <span className="text-green-400 text-sm mb-2 font-medium">{t.todayPrice} {currentLanguage !== 'en' && `/ ${translations['en'].todayPrice}`}</span>
                            <div className="text-4xl font-bold text-white mb-1">{data.current_price}</div>
                            <span className="text-gray-400 text-xs">{data.price_unit}</span>
                        </div>
                        <div className="bg-blue-900/20 border border-blue-500/30 p-6 rounded-2xl flex flex-col items-center justify-center text-center">
                            <span className="text-blue-400 text-sm mb-2 font-medium">{t.change} {currentLanguage !== 'en' && `/ ${translations['en'].change}`}</span>
                            <div className="text-4xl font-bold text-white mb-1">{data.change}</div>
                        </div>
                    </div>

                    {/* Price History Chart */}
                    <div className="glass-panel p-6 rounded-3xl border-white/5">
                        <PriceHistoryChart data={data.history} />
                    </div>

                    {/* Recent Data Table */}
                    <div className="glass-panel p-6 rounded-3xl border-white/5">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-orange-400" />
                            {t.recent} {currentLanguage !== 'en' && `/ ${translations['en'].recent}`}
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-gray-400 border-b border-white/10">
                                        <th className="py-3 px-2 font-medium">{t.date} {currentLanguage !== 'en' && `/ ${translations['en'].date}`}</th>
                                        <th className="py-3 px-2 font-medium">{t.min} {currentLanguage !== 'en' && `/ ${translations['en'].min}`}</th>
                                        <th className="py-3 px-2 font-medium">{t.max} {currentLanguage !== 'en' && `/ ${translations['en'].max}`}</th>
                                        <th className="py-3 px-2 font-medium text-green-400">{t.modal} {currentLanguage !== 'en' && `/ ${translations['en'].modal}`}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.recent_data.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="py-8 text-center text-gray-500 italic">
                                                No recent price data reported for {crop} in {district === 'All Districts' ? state : district}.
                                            </td>
                                        </tr>
                                    ) : (
                                        data.recent_data.map((row: any, i: number) => (
                                            <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                <td className="py-3 px-2 text-sm text-gray-300">{row.date}</td>
                                                <td className="py-3 px-2 text-sm text-gray-300">{row.min}</td>
                                                <td className="py-3 px-2 text-sm text-gray-300">{row.max}</td>
                                                <td className="py-3 px-2 text-sm text-green-400 font-bold">{row.modal}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


export default MandiInterface;
