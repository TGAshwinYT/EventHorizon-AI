import { useState, useRef, useEffect } from 'react';
import { Search, TrendingUp, Sprout, ArrowLeft, Loader2, BookOpen, Truck, Landmark, BarChart3, Volume2, StopCircle, Youtube, User, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

interface MarketDashboardProps {
    onBack: () => void;
    currentLanguage: string;
    labels: any;
    onMoreDetails?: (query: string) => void;
}

type View = 'menu' | 'rates' | 'vehicles' | 'vehicle_details' | 'schemes' | 'advice' | 'marketing';

interface Story {
    name: string;
    location: string;
    content: string;
    image_prompt?: string;
}

const MarketDashboard = ({ onBack, currentLanguage, labels, onMoreDetails }: MarketDashboardProps) => {
    const [view, setView] = useState<View>('menu');
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedVehicleIndex, setSelectedVehicleIndex] = useState<number | null>(null);

    // Data State
    const [ratesResult, setRatesResult] = useState<{ summary: string, details: string | null } | null>(null);
    const [showRatesDetails, setShowRatesDetails] = useState(false);

    // Marketing stories are dynamic
    const [stories, setStories] = useState<Story[]>([]);



    // Audio State
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [playingText, setPlayingText] = useState<string | null>(null);

    const stopAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current = null;
        }
        window.speechSynthesis.cancel();
        setPlayingText(null);
    };

    const playTTS = async (text: string) => {
        if (playingText === text) {
            stopAudio();
            return;
        }
        stopAudio();
        setPlayingText(text);

        try {
            const response = await fetch('/api/chat/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, language: currentLanguage })
            });
            const data = await response.json();
            if (data.audio_url) {
                const audio = new Audio(data.audio_url);
                audioRef.current = audio;
                audio.onended = () => setPlayingText(null);
                audio.play();
            }
        } catch (e) {
            console.error("TTS Error", e);
            setPlayingText(null);
        }
    };

    const fetchGeneric = async (type: string, topic: string) => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/chat/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ topic, type, language: currentLanguage })
            });
            const data = await response.json();
            return data;
        } catch (e) {
            console.error(`Failed to fetch ${type}`, e);
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    // Load initial marketing stories
    useEffect(() => {
        if (view === 'marketing' && stories.length === 0) {
            fetchGeneric('marketing', 'Sustainable Farming').then(data => {
                if (data && Array.isArray(data)) setStories(data);
            });
        }
    }, [view]);

    const handleRateSearch = async () => {
        if (!searchTerm.trim()) return;
        setIsLoading(true);
        setRatesResult(null);
        setShowRatesDetails(false);

        try {
            const response = await fetch('/api/chat/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `Provide real-time market price trends and cultivation advice for ${searchTerm} in India.`,
                    language: currentLanguage,
                    type: 'market' // This tells backend to use the structured formatter
                }),
            });
            const data = await response.json();
            // Backend returns: Summary ||| Details
            const [summary, details] = data.response_text.split('|||').map((s: string) => s.trim());

            setRatesResult({
                summary: (summary || data.response_text).replace(/\*/g, ''),
                details: (details || null)?.replace(/\*/g, '')
            });
        } catch (error) {
            console.error("Search failed:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearchMarketing = () => {
        if (!searchTerm.trim()) return;
        setStories([]);
        fetchGeneric('marketing', searchTerm).then(data => {
            if (data && Array.isArray(data)) setStories(data);
        });
    };

    const renderMenu = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in pb-8">
            <div onClick={() => setView('rates')} className="glass-panel p-6 rounded-3xl cursor-pointer hover:bg-white/10 transition-all border-emerald-500/20 group">
                <TrendingUp className="w-10 h-10 text-emerald-400 mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="text-xl font-bold mb-2">{labels.rates}</h3>
                <p className="text-gray-400 text-sm">Check daily market prices for crops in your mandi.</p>
            </div>

            <div onClick={() => setView('vehicles')} className="glass-panel p-6 rounded-3xl cursor-pointer hover:bg-white/10 transition-all border-blue-500/20 group">
                <Truck className="w-10 h-10 text-blue-400 mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="text-xl font-bold mb-2">{labels.vehicles}</h3>
                <p className="text-gray-400 text-sm">Tractors, harvesters, and transport vehicle prices.</p>
            </div>

            <div onClick={() => setView('schemes')} className="glass-panel p-6 rounded-3xl cursor-pointer hover:bg-white/10 transition-all border-amber-500/20 group">
                <Landmark className="w-10 h-10 text-amber-400 mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="text-xl font-bold mb-2">{labels.schemes}</h3>
                <p className="text-gray-400 text-sm">Central and State schemes for subsidies and loans.</p>
            </div>

            <div onClick={() => setView('marketing')} className="glass-panel p-6 rounded-3xl cursor-pointer hover:bg-white/10 transition-all border-pink-500/20 group">
                <BarChart3 className="w-10 h-10 text-pink-400 mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="text-xl font-bold mb-2">{labels.marketing}</h3>
                <p className="text-gray-400 text-sm">Success stories, bloggers, and selling strategies.</p>
            </div>

            <div className="glass-panel p-6 rounded-3xl border-purple-500/10 opacity-50">
                <BookOpen className="w-10 h-10 text-purple-400 mb-4" />
                <h3 className="text-xl font-bold mb-2">{labels.advice}</h3>
                <p className="text-gray-400 text-sm">Included in Real-time Rates search results.</p>
            </div>
        </div>
    );

    const renderSearchBar = (placeholder: string, onSearch: () => void) => (
        <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                    type="text"
                    placeholder={placeholder}
                    className="w-full bg-black/20 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && onSearch()}
                />
            </div>
            <button
                onClick={onSearch}
                disabled={isLoading}
                className="px-8 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-2xl transition-colors flex items-center gap-2"
            >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Search"}
            </button>
        </div>
    );

    // Vehicle Translations
    const vehicleTranslations: { [key: string]: any[] } = {
        en: [
            {
                name: 'John Deere 5310',
                type: 'Tractor',
                price: '₹8.5 Lakhs',
                purpose: 'Heavy Duty Plowing',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/8/87/John_Deere_5310_utility_tractor,_rear.jpg',
                official_link: 'https://www.deere.co.in/en/tractors/e-series-tractors/5310e-tractor/',
                specs: {
                    Engine: '55 HP, 3 Cylinders',
                    Gearbox: '9 Forward + 3 Reverse',
                    Brakes: 'Oil Immersed Disc Brakes',
                    Warranty: '5000 Hours / 5 Years'
                },
                description: 'The John Deere 5310 is a powerful Tractor designed for Heavy Duty Plowing. Perfect for Indian farming conditions with low maintenance and high efficiency.'
            },
            {
                name: 'Mahindra JIVO 245 DI 4WD',
                type: 'Mini Tractor',
                price: '₹4.2 Lakhs',
                purpose: 'Orchard Farming',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Mahindra_tractor.JPG',
                official_link: 'https://www.mahindratractor.com/tractors/jivo-245-di-4wd',
                specs: {
                    Engine: '24 HP, 2 Cylinders',
                    Gearbox: '8 Forward + 4 Reverse',
                    Brakes: 'Oil Immersed Brakes',
                    'Lift Capacity': '750 kg'
                },
                description: 'The Mahindra JIVO 245 DI 4WD is a powerful Mini Tractor designed for Orchard Farming. Perfect for Indian farming conditions with low maintenance and high efficiency.'
            },
            {
                name: 'Sonalika DI 745',
                type: 'Tractor',
                price: '₹6.8 Lakhs',
                purpose: 'Haulage & Cultivation',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/9/93/Sonalika_DI_tractor.jpg',
                official_link: 'https://www.sonalika.com/tractor/di-745-iii.html',
                specs: {
                    Engine: '50 HP, 3 Cylinders',
                    Gearbox: '8 Forward + 2 Reverse',
                    Clutch: 'Dual Clutch',
                    Steering: 'Power Steering'
                },
                description: 'The Sonalika DI 745 is a powerful Tractor designed for Haulage & Cultivation. Perfect for Indian farming conditions with low maintenance and high efficiency.'
            },
            {
                name: 'Tata Ace Gold',
                type: 'Transport',
                price: '₹5.0 Lakhs',
                purpose: 'Goods Transport',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Tata_Ace_Mini_Truck_(1).JPG',
                official_link: 'https://smalltrucks.tatamotors.com/listing-page?field_product_category_target_id=1',
                specs: {
                    Engine: '700 cc, 2 Cylinders',
                    Payload: '710 kg',
                    Mileage: '22 kmpl',
                    Fuel: 'Diesel / CNG'
                },
                description: 'The Tata Ace Gold is a powerful Transport designed for Goods Transport. Perfect for Indian farming conditions with low maintenance and high efficiency.'
            },
            {
                name: 'Kubota MU4501',
                type: 'Tractor',
                price: '₹7.9 Lakhs',
                purpose: 'Fuel Efficient',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Kubota_tractor_9.jpg',
                official_link: 'https://tractorguru.in/tractor/kubota-mu4501',
                specs: {
                    Engine: '45 HP, 4 Cylinders',
                    Transmission: 'Synchromesh',
                    PTO: 'Dual PTO',
                    Brakes: 'Oil Immersed Disc Brakes'
                },
                description: 'The Kubota MU4501 is a powerful Tractor designed for Fuel Efficient. Perfect for Indian farming conditions with low maintenance and high efficiency.'
            },
        ],
        ta: [
            {
                name: 'ஜான் டியர் 5310',
                type: 'டிராக்டர்',
                price: '₹8.5 லட்சம்',
                purpose: 'கனரக உழவு',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/8/87/John_Deere_5310_utility_tractor,_rear.jpg',
                official_link: 'https://www.deere.co.in/en/tractors/e-series-tractors/5310e-tractor/',
                specs: {
                    'இயந்திரம்': '55 HP, 3 சிலிண்டர்கள்',
                    'கியர்பாக்ஸ்': '9 முன் + 3 பின்',
                    'பிரேக்குகள்': 'ஆயில் இம்மர்ஸ்ட் டிஸ்க் பிரேக்குகள்',
                    'உத்தரவாதம்': '5000 மணிநேரம் / 5 ஆண்டுகள்'
                },
                description: 'ஜான் டியர் 5310 கனரக உழவுக்காக வடிவமைக்கப்பட்ட ஒரு சக்திவாய்ந்த டிராக்டர் ஆகும். குறைந்த பராமரிப்பு மற்றும் அதிக செயல்திறனுடன் இந்திய விவசாய நிலைமைகளுக்கு ஏற்றது.'
            },
            {
                name: 'மஹிந்திரா ஜிவோ 245 DI 4WD',
                type: 'மினி டிராக்டர்',
                price: '₹4.2 லட்சம்',
                purpose: 'தோட்டக்கலை விவசாயம்',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Mahindra_tractor.JPG',
                official_link: 'https://www.mahindratractor.com/tractors/jivo-245-di-4wd',
                specs: {
                    'இயந்திரம்': '24 HP, 2 சிலிண்டர்கள்',
                    'கியர்பாக்ஸ்': '8 முன் + 4 பின்',
                    'பிரேக்குகள்': 'ஆயில் இம்மர்ஸ்ட் பிரேக்குகள்',
                    'தூக்கும் திறன்': '750 கிலோ'
                },
                description: 'மஹிந்திரா ஜிவோ 245 DI 4WD என்பது தோட்டக்கலை விவசாயத்திற்காக வடிவமைக்கப்பட்ட ஒரு சக்திவாய்ந்த மினி டிராக்டர் ஆகும். குறைந்த பராமரிப்பு மற்றும் அதிக செயல்திறனுடன் இந்திய விவசாய நிலைமைகளுக்கு ஏற்றது.'
            },
            {
                name: 'சோனாலிகா DI 745',
                type: 'டிராக்டர்',
                price: '₹6.8 லட்சம்',
                purpose: 'சரக்கு மற்றும் உழவு',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/9/93/Sonalika_DI_tractor.jpg',
                official_link: 'https://www.sonalika.com/tractor/di-745-iii.html',
                specs: {
                    'இயந்திரம்': '50 HP, 3 சிலிண்டர்கள்',
                    'கியர்பாக்ஸ்': '8 முன் + 2 பின்',
                    'கிளட்ச்': 'இரட்டை கிளட்ச்',
                    'ஸ்டீயரிங்': 'பவர் ஸ்டீயரிங்'
                },
                description: 'சோனாலிகா DI 745 என்பது சரக்கு மற்றும் உழவுக்காக வடிவமைக்கப்பட்ட ஒரு சக்திவாய்ந்த டிராக்டர் ஆகும். குறைந்த பராமரிப்பு மற்றும் அதிக செயல்திறனுடன் இந்திய விவசாய நிலைமைகளுக்கு ஏற்றது.'
            },
            {
                name: 'டாடா ஏஸ் கோல்ட்',
                type: 'போக்குவரத்து',
                price: '₹5.0 லட்சம்',
                purpose: 'சரக்கு போக்குவரத்து',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Tata_Ace_Mini_Truck_(1).JPG',
                official_link: 'https://smalltrucks.tatamotors.com/listing-page?field_product_category_target_id=1',
                specs: {
                    'இயந்திரம்': '700 சிசி, 2 சிலிண்டர்கள்',
                    'பேலோட்': '710 கிலோ',
                    'மைலேஜ்': '22 கிமீ/லி',
                    'எரிபொருள்': 'டீசல் / சிஎன்ஜி'
                },
                description: 'டாடா ஏஸ் கோல்ட் என்பது சரக்கு போக்குவரத்திற்காக வடிவமைக்கப்பட்ட ஒரு சக்திவாய்ந்த வாகனம் ஆகும். குறைந்த பராமரிப்பு மற்றும் அதிக செயல்திறனுடன் இந்திய விவசாய நிலைமைகளுக்கு ஏற்றது.'
            },
            {
                name: 'குபோடா MU4501',
                type: 'டிராக்டர்',
                price: '₹7.9 லட்சம்',
                purpose: 'எரிபொருள் சிக்கனம்',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Kubota_tractor_9.jpg',
                official_link: 'https://tractorguru.in/tractor/kubota-mu4501',
                specs: {
                    'இயந்திரம்': '45 HP, 4 சிலிண்டர்கள்',
                    'டிரான்ஸ்மிஷன்': 'சின்க்ரோமேஷ்',
                    'PTO': 'இரட்டை PTO',
                    'பிரேக்குகள்': 'ஆயில் இம்மர்ஸ்ட் டிஸ்க் பிரேக்குகள்'
                },
                description: 'குபோடா MU4501 எரிபொருள் சிக்கனத்திற்காக வடிவமைக்கப்பட்ட ஒரு சக்திவாய்ந்த டிராக்டர் ஆகும். குறைந்த பராமரிப்பு மற்றும் அதிக செயல்திறனுடன் இந்திய விவசாய நிலைமைகளுக்கு ஏற்றது.'
            }
        ],
        hi: [
            {
                name: 'जॉन डियर 5310',
                type: 'ट्रैक्टर',
                price: '₹8.5 लाख',
                purpose: 'भारी जुताई',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/8/87/John_Deere_5310_utility_tractor,_rear.jpg',
                official_link: 'https://www.deere.co.in/en/tractors/e-series-tractors/5310e-tractor/',
                specs: {
                    'इंजन': '55 HP, 3 सिलेंडर',
                    'गियरबॉक्स': '9 आगे + 3 पीछे',
                    'ब्रेक': 'तेल में डूबे डिस्क ब्रेक',
                    'वारंटी': '5000 घंटे / 5 साल'
                },
                description: 'जॉन डियर 5310 भारी जुताई के लिए डिज़ाइन किया गया एक शक्तिशाली ट्रैक्टर है। कम रखरखाव और उच्च दक्षता के साथ भारतीय खेती की स्थिति के लिए बिल्कुल सही।'
            },
            {
                name: 'महिंद्रा जिवो 245 DI 4WD',
                type: 'मिनी ट्रैक्टर',
                price: '₹4.2 लाख',
                purpose: 'बागवानी खेती',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Mahindra_tractor.JPG',
                official_link: 'https://www.mahindratractor.com/tractors/jivo-245-di-4wd',
                specs: {
                    'इंजन': '24 HP, 2 सिलेंडर',
                    'गियरबॉक्स': '8 आगे + 4 पीछे',
                    'ब्रेक': 'तेल में डूबे ब्रेक',
                    'लिफ्ट क्षमता': '750 किलो'
                },
                description: 'महिंद्रा जिवो 245 DI 4WD बागवानी खेती के लिए डिज़ाइन किया गया एक शक्तिशाली मिनी ट्रैक्टर है। कम रखरखाव और उच्च दक्षता के साथ भारतीय खेती की स्थिति के लिए बिल्कुल सही।'
            },
            {
                name: 'सोनालिका DI 745',
                type: 'ट्रैक्टर',
                price: '₹6.8 लाख',
                purpose: 'ढुलाई और खेती',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/9/93/Sonalika_DI_tractor.jpg',
                official_link: 'https://www.sonalika.com/tractor/di-745-iii.html',
                specs: {
                    'इंजन': '50 HP, 3 सिलेंडर',
                    'गियरबॉक्स': '8 आगे + 2 पीछे',
                    'क्लच': 'डुअल क्लच',
                    'स्टीयरिंग': 'पावर स्टीयरिंग'
                },
                description: 'सोनालिका DI 745 ढुलाई और खेती के लिए डिज़ाइन किया गया एक शक्तिशाली ट्रैक्टर है। कम रखरखाव और उच्च दक्षता के साथ भारतीय खेती की स्थिति के लिए बिल्कुल सही।'
            },
            {
                name: 'टाटा ऐस गोल्ड',
                type: 'परिवहन',
                price: '₹5.0 लाख',
                purpose: 'माल परिवहन',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Tata_Ace_Mini_Truck_(1).JPG',
                official_link: 'https://smalltrucks.tatamotors.com/listing-page?field_product_category_target_id=1',
                specs: {
                    'इंजन': '700 सीसी, 2 सिलेंडर',
                    'पेलोड': '710 किग्रा',
                    'माइलेज': '22 किमी/लीटर',
                    'ईंधन': 'डीजल / सीएनजी'
                },
                description: 'टाटा ऐस गोल्ड माल परिवहन के लिए डिज़ाइन किया गया एक शक्तिशाली वाहन है। कम रखरखाव और उच्च दक्षता के साथ भारतीय खेती की स्थिति के लिए बिल्कुल सही।'
            },
            {
                name: 'कुबोटा MU4501',
                type: 'ट्रैक्टर',
                price: '₹7.9 लाख',
                purpose: 'ईंधन कुशल',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Kubota_tractor_9.jpg',
                official_link: 'https://tractorguru.in/tractor/kubota-mu4501',
                specs: {
                    'इंजन': '45 HP, 4 सिलेंडर',
                    'ट्रांसमिशन': 'सिन्क्रोमेश',
                    'PTO': 'डुअल PTO',
                    'ब्रेक': 'तेल में डूबे डिस्क ब्रेक'
                },
                description: 'कुबोटा MU4501 ईंधन कुशलता के लिए डिज़ाइन किया गया एक शक्तिशाली ट्रैक्टर है। कम रखरखाव और उच्च दक्षता के साथ भारतीय खेती की स्थिति के लिए बिल्कुल सही।'
            }
        ],
        te: [
            {
                name: 'జాన్ డీర్ 5310',
                type: 'ట్రాక్టర్',
                price: '₹8.5 లక్షలు',
                purpose: 'భారీ దున్నకం',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/8/87/John_Deere_5310_utility_tractor,_rear.jpg',
                official_link: 'https://www.deere.co.in/en/tractors/e-series-tractors/5310e-tractor/',
                specs: {
                    'ఇంజిన్': '55 HP, 3 సిలిండర్లు',
                    'గేర్‌బాక్స్': '9 ఫార్వర్డ్ + 3 రివర్స్',
                    'బ్రేకులు': 'ఆయిల్ ఇమ్మర్స్డ్ డిస్క్ బ్రేకులు',
                    'వారంటీ': '5000 గంటలు / 5 సంవత్సరాలు'
                },
                description: 'జాన్ డీర్ 5310 భారీ దున్నకం కోసం రూపొందించిన శక్తివంతమైన ట్రాక్టర్. తక్కువ నిర్వహణ మరియు అధిక సామర్థ్యంతో భారతీయ వ్యవసాయ పరిస్థితులకు సరైనది.'
            },
            {
                name: 'మహీంద్రా జీవో 245 DI 4WD',
                type: 'మినీ ట్రాక్టర్',
                price: '₹4.2 లక్షలు',
                purpose: 'తోటల సాగు',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Mahindra_tractor.JPG',
                official_link: 'https://www.mahindratractor.com/tractors/jivo-245-di-4wd',
                specs: {
                    'ఇంజిన్': '24 HP, 2 సిలిండర్లు',
                    'గేర్‌బాక్స్': '8 ఫార్వర్డ్ + 4 రివర్స్',
                    'బ్రేకులు': 'ఆయిల్ ఇమ్మర్స్డ్ బ్రేకులు',
                    'లిఫ్ట్ కెపాసిటీ': '750 కిలోలు'
                },
                description: 'మహీంద్రా జీవో 245 DI 4WD తోటల సాగు కోసం రూపొందించిన శక్తివంతమైన మినీ ట్రాక్టర్. తక్కువ నిర్వహణ మరియు అధిక సామర్థ్యంతో భారతీయ వ్యవసాయ పరిస్థితులకు సరైనది.'
            },
            {
                name: 'సోనాలికా DI 745',
                type: 'ట్రాక్టర్',
                price: '₹6.8 లక్షలు',
                purpose: 'రవాణా & సాగు',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/9/93/Sonalika_DI_tractor.jpg',
                official_link: 'https://www.sonalika.com/tractor/di-745-iii.html',
                specs: {
                    'ఇంజిన్': '50 HP, 3 సిలిండర్లు',
                    'గేర్‌బాక్స్': '8 ఫార్వర్డ్ + 2 రివర్స్',
                    'క్లచ్': 'డ్యుయల్ క్లచ్',
                    'స్టీరింగ్': 'పవర్ స్టీరింగ్'
                },
                description: 'సోనాలికా DI 745 రవాణా మరియు సాగు కోసం రూపొందించిన శక్తివంతమైన ట్రాక్టర్. తక్కువ నిర్వహణ మరియు అధిక సామర్థ్యంతో భారతీయ వ్యవసాయ పరిస్థితులకు సరైనది.'
            },
            {
                name: ' టాటా ఏస్ గోల్డ్',
                type: 'రవాణా',
                price: '₹5.0 లక్షలు',
                purpose: 'సరుకు రవాణా',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Tata_Ace_Mini_Truck_(1).JPG',
                official_link: 'https://smalltrucks.tatamotors.com/listing-page?field_product_category_target_id=1',
                specs: {
                    'ఇంజిన్': '700 cc, 2 సిలిండర్లు',
                    'పేలోడ్': '710 కిలోలు',
                    'మైలేజ్': '22 kmpl',
                    'ఇంధనం': 'డీజిల్ / CNG'
                },
                description: 'టాటా ఏస్ గోల్డ్ సరుకు రవాణా కోసం రూపొందించిన శక్తివంతమైన వాహనం. తక్కువ నిర్వహణ మరియు అధిక సామర్థ్యంతో భారతీయ వ్యవసాయ పరిస్థితులకు సరైనది.'
            },
            {
                name: 'కుబోటా MU4501',
                type: 'ట్రాక్టర్',
                price: '₹7.9 లక్షలు',
                purpose: 'ఇంధన ఆదా',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Kubota_tractor_9.jpg',
                official_link: 'https://tractorguru.in/tractor/kubota-mu4501',
                specs: {
                    'ఇంజిన్': '45 HP, 4 సిలిండర్లు',
                    'ట్రాన్స్మిషన్': 'సింక్రోమెష్',
                    'PTO': 'డ్యుయల్ PTO',
                    'బ్రేకులు': 'ఆయిల్ ఇమ్మర్స్డ్ డిస్క్ బ్రేకులు'
                },
                description: 'కుబోటా MU4501 ఇంధన ఆదా కోసం రూపొందించిన శక్తివంతమైన ట్రాక్టర్. తక్కువ నిర్వహణ మరియు అధిక సామర్థ్యంతో భారతీయ వ్యవసాయ పరిస్థితులకు సరైనది.'
            }
        ],
        kn: [
            {
                name: 'ಜಾನ್ ಡೀರ್ 5310',
                type: 'ಟ್ರ್ಯಾಕ್ಟರ್',
                price: '₹8.5 ಲಕ್ಷ',
                purpose: 'ಭಾರೀ ಉಳುವಿಕೆ',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/8/87/John_Deere_5310_utility_tractor,_rear.jpg',
                official_link: 'https://www.deere.co.in/en/tractors/e-series-tractors/5310e-tractor/',
                specs: {
                    'ಎಂಜಿನ್': '55 HP, 3 ಸಿಲಿಂಡರ್‌ಗಳು',
                    'ಗೇರ್‌ಬಾಕ್ಸ್': '9 ಫಾರ್ವರ್ಡ್ + 3 ರಿವರ್ಸ್',
                    'ಬ್ರೇಕ್‌ಗಳು': 'ಆಯಿಲ್ ಇಮ್ಮರ್ಸ್ಡ್ ಡಿಸ್ಕ್ ಬ್ರೇಕ್‌ಗಳು',
                    'ವಾರೆಂಟಿ': '5000 ಗಂಟೆಗಳು / 5 ವರ್ಷಗಳು'
                },
                description: 'ಜಾನ್ ಡೀರ್ 5310 ಭಾರೀ ಉಳುವಿಕೆಗಾಗಿ ವಿನ್ಯಾಸಗೊಳಿಸಲಾದ ಶಕ್ತಿಯುತ ಟ್ರ್ಯಾಕ್ಟರ್ ಆಗಿದೆ. ಕಡಿಮೆ ನಿರ್ವಹಣೆ ಮತ್ತು ಹೆಚ್ಚಿನ ದಕ್ಷತೆಯೊಂದಿಗೆ ಭಾರತೀಯ ಕೃಷಿ ಪರಿಸ್ಥಿತಿಗಳಿಗೆ ಸೂಕ್ತವಾಗಿದೆ.'
            },
            {
                name: 'ಮಹೀಂದ್ರಾ ಜಿವೋ 245 DI 4WD',
                type: 'ಮಿನಿ ಟ್ರ್ಯಾಕ್ಟರ್',
                price: '₹4.2 ಲಕ್ಷ',
                purpose: 'ತೋಟಗಾರಿಕೆ ಕೃಷಿ',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Mahindra_tractor.JPG',
                official_link: 'https://www.mahindratractor.com/tractors/jivo-245-di-4wd',
                specs: {
                    'ಎಂಜಿನ್': '24 HP, 2 ಸಿಲಿಂಡರ್‌ಗಳು',
                    'ಗೇರ್‌ಬಾಕ್ಸ್': '8 ಫಾರ್ವರ್ಡ್ + 4 ರಿವರ್ಸ್',
                    'ಬ್ರೇಕ್‌ಗಳು': 'ಆಯಿಲ್ ಇಮ್ಮರ್ಸ್ಡ್ ಬ್ರೇಕ್‌ಗಳು',
                    'ಲಿಫ್ಟ್ ಸಾಮರ್ಥ್ಯ': '750 ಕೆಜಿ'
                },
                description: 'ಮಹೀಂದ್ರಾ ಜಿವೋ 245 DI 4WD ತೋಟಗಾರಿಕೆ ಕೃಷಿಗಾಗಿ ವಿನ್ಯಾಸಗೊಳಿಸಲಾದ ಶಕ್ತಿಯುತ ಮಿನಿ ಟ್ರ್ಯಾಕ್ಟರ್ ಆಗಿದೆ. ಕಡಿಮೆ ನಿರ್ವಹಣೆ ಮತ್ತು ಹೆಚ್ಚಿನ ದಕ್ಷತೆಯೊಂದಿಗೆ ಭಾರತೀಯ ಕೃಷಿ ಪರಿಸ್ಥಿತಿಗಳಿಗೆ ಸೂಕ್ತವಾಗಿದೆ.'
            },
            {
                name: 'ಸೋನಾಲಿಕಾ DI 745',
                type: 'ಟ್ರ್ಯಾಕ್ಟರ್',
                price: '₹6.8 ಲಕ್ಷ',
                purpose: 'ಸಾಗಣೆ ಮತ್ತು ಕೃಷಿ',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/9/93/Sonalika_DI_tractor.jpg',
                official_link: 'https://www.sonalika.com/tractor/di-745-iii.html',
                specs: {
                    'ಎಂಜಿನ್': '50 HP, 3 ಸಿಲಿಂಡರ್‌ಗಳು',
                    'ಗೇರ್‌ಬಾಕ್ಸ್': '8 ಫಾರ್ವರ್ಡ್ + 2 ರಿವರ್ಸ್',
                    'ಕ್ಲಚ್': 'ಡ್ಯುಯಲ್ ಕ್ಲಚ್',
                    'ಸ್ಟೀರಿಂಗ್': 'ಪವರ್ ಸ್ಟೀರಿಂಗ್'
                },
                description: 'ಸೋನಾಲಿಕಾ DI 745 ಸಾಗಣೆ ಮತ್ತು ಕೃಷಿಗಾಗಿ ವಿನ್ಯಾಸಗೊಳಿಸಲಾದ ಶಕ್ತಿಯುತ ಟ್ರ್ಯಾಕ್ಟರ್ ಆಗಿದೆ. ಕಡಿಮೆ ನಿರ್ವಹಣೆ ಮತ್ತು ಹೆಚ್ಚಿನ ದಕ್ಷತೆಯೊಂದಿಗೆ ಭಾರತೀಯ ಕೃಷಿ ಪರಿಸ್ಥಿತಿಗಳಿಗೆ ಸೂಕ್ತವಾಗಿದೆ.'
            },
            {
                name: 'ಟಾಟಾ ಏಸ್ ಗೋಲ್ಡ್',
                type: 'ಸಾರಿಗೆ',
                price: '₹5.0 ಲಕ್ಷ',
                purpose: 'ಸರಕು ಸಾಗಣೆ',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Tata_Ace_Mini_Truck_(1).JPG',
                official_link: 'https://smalltrucks.tatamotors.com/listing-page?field_product_category_target_id=1',
                specs: {
                    'ಎಂಜಿನ್': '700 ಸಿಸಿ, 2 ಸಿಲಿಂಡರ್‌ಗಳು',
                    'ಪೇಲೋಡ್': '710 ಕೆಜಿ',
                    'ಮೈಲೇಜ್': '22 ಕಿಮೀ/ಲೀ',
                    'ಇಂಧನ': 'ಡೀಸೆಲ್ / ಸಿಎನ್‌ಜಿ'
                },
                description: 'ಟಾಟಾ ಏಸ್ ಗೋಲ್ಡ್ ಸರಕು ಸಾಗಣೆಗಾಗಿ ವಿನ್ಯಾಸಗೊಳಿಸಲಾದ ಶಕ್ತಿಯುತ ವಾಹನವಾಗಿದೆ. ಕಡಿಮೆ ನಿರ್ವಹಣೆ ಮತ್ತು ಹೆಚ್ಚಿನ ದಕ್ಷತೆಯೊಂದಿಗೆ ಭಾರತೀಯ ಕೃಷಿ ಪರಿಸ್ಥಿತಿಗಳಿಗೆ ಸೂಕ್ತವಾಗಿದೆ.'
            },
            {
                name: 'ಕುಬೋಟಾ MU4501',
                type: 'ಟ್ರ್ಯಾಕ್ಟರ್',
                price: '₹7.9 ಲಕ್ಷ',
                purpose: 'ಇಂಧನ ಉಳಿತಾಯ',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Kubota_tractor_9.jpg',
                official_link: 'https://tractorguru.in/tractor/kubota-mu4501',
                specs: {
                    'ಎಂಜಿನ್': '45 HP, 4 ಸಿಲಿಂಡರ್‌ಗಳು',
                    'ಟ್ರಾನ್ಸ್‌ಮಿಷನ್': 'ಸಿಂಕ್ರೋಮೆಶ್',
                    'PTO': 'ಡ್ಯುಯಲ್ PTO',
                    'ಬ್ರೇಕ್‌ಗಳು': 'ಆಯಿಲ್ ಇಮ್ಮರ್ಸ್ಡ್ ಡಿಸ್ಕ್ ಬ್ರೇಕ್‌ಗಳು'
                },
                description: 'ಕುಬೋಟಾ MU4501 ಇಂಧನ ಉಳಿತಾಯಕ್ಕಾಗಿ ವಿನ್ಯಾಸಗೊಳಿಸಲಾದ ಶಕ್ತಿಯುತ ಟ್ರ್ಯಾಕ್ಟರ್ ಆಗಿದೆ. ಕಡಿಮೆ ನಿರ್ವಹಣೆ ಮತ್ತು ಹೆಚ್ಚಿನ ದಕ್ಷತೆಯೊಂದಿಗೆ ಭಾರತೀಯ ಕೃಷಿ ಪರಿಸ್ಥಿತಿಗಳಿಗೆ ಸೂಕ್ತವಾಗಿದೆ.'
            }
        ],
        ml: [
            {
                name: 'ജോൺ ഡീർ 5310',
                type: 'ട്രാക്ടർ',
                price: '₹8.5 ലക്ഷം',
                purpose: 'ഹെവി ഡ്യൂട്ടി ഉഴവ്',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/8/87/John_Deere_5310_utility_tractor,_rear.jpg',
                official_link: 'https://www.deere.co.in/en/tractors/e-series-tractors/5310e-tractor/',
                specs: {
                    'എഞ്ചിൻ': '55 HP, 3 സിലിണ്ടറുകൾ',
                    'ഗിയർബോക്സ്': '9 ഫോർവേഡ് + 3 റിവേഴ്സ്',
                    'ബ്രേക്കുകൾ': 'ഓയിൽ ഇമ്മേഴ്സ്ഡ് ഡിസ്ക് ബ്രേക്കുകൾ',
                    'വാറന്റി': '5000 മണിക്കൂർ / 5 വർഷം'
                },
                description: 'ജോൺ ഡീർ 5310 ഹെവി ഡ്യൂട്ടി ഉഴവിനായി രൂപകൽപ്പന ചെയ്ത ശക്തമായ ട്രാക്ടറാണ്. കുറഞ്ഞ അറ്റകുറ്റപ്പണിയും ഉയർന്ന കാര്യക്ഷമതയും ഉള്ളതിനാൽ ഇന്ത്യൻ കാർഷിക സാഹചര്യങ്ങൾക്ക് അനുയോജ്യമാണ്.'
            },
            {
                name: 'മഹിന്ദ്ര ജിവോ 245 DI 4WD',
                type: 'മിനി ട്രാക്ടർ',
                price: '₹4.2 ലക്ഷം',
                purpose: 'തോട്ടം കൃഷി',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Mahindra_tractor.JPG',
                official_link: 'https://www.mahindratractor.com/tractors/jivo-245-di-4wd',
                specs: {
                    'എഞ്ചിൻ': '24 HP, 2 സിലിണ്ടറുകൾ',
                    'ഗിയർബോക്സ്': '8 ഫോർവേഡ് + 4 റിവേഴ്സ്',
                    'ബ്രേക്കുകൾ': 'ഓയിൽ ഇമ്മേഴ്സ്ഡ് ബ്രേക്കുകൾ',
                    'ലിഫ്റ്റ് ശേഷി': '750 കിലോഗ്രാം'
                },
                description: 'മഹിന്ദ്ര ജിവോ 245 DI 4WD തോട്ടം കൃഷിക്കായി രൂപകൽപ്പന ചെയ്ത ശക്തമായ മിനി ട്രാക്ടറാണ്. കുറഞ്ഞ അറ്റകുറ്റപ്പണിയും ഉയർന്ന കാര്യക്ഷമതയും ഉള്ളതിനാൽ ഇന്ത്യൻ കാർഷിക സാഹചര്യങ്ങൾക്ക് അനുയോജ്യമാണ്.'
            },
            {
                name: 'സോണാലിക DI 745',
                type: 'ട്രാക്ടർ',
                price: '₹6.8 ലക്ഷം',
                purpose: 'ഗതാഗതവും കൃഷിയും',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/9/93/Sonalika_DI_tractor.jpg',
                official_link: 'https://www.sonalika.com/tractor/di-745-iii.html',
                specs: {
                    'എഞ്ചിൻ': '50 HP, 3 സിലിണ്ടറുകൾ',
                    'ഗിയർബോക്സ്': '8 ഫോർവേഡ് + 2 റിവേഴ്സ്',
                    'ക്ലച്ച്': 'ഡ്യുവൽ ക്ലച്ച്',
                    'സ്റ്റിയറിംഗ്': 'പവർ സ്റ്റിയറിംഗ്'
                },
                description: 'സോണാലിക DI 745 ഗതാഗതത്തിനും കൃഷിക്കുമായി രൂപകൽപ്പന ചെയ്ത ശക്തമായ ട്രാക്ടറാണ്. കുറഞ്ഞ അറ്റകുറ്റപ്പണിയും ഉയർന്ന കാര്യക്ഷമതയും ഉള്ളതിനാൽ ഇന്ത്യൻ കാർഷിക സാഹചര്യങ്ങൾക്ക് അനുയോജ്യമാണ്.'
            },
            {
                name: 'ടാറ്റ ഏസ് ഗോൾഡ്',
                type: 'ഗതാഗതം',
                price: '₹5.0 ലക്ഷം',
                purpose: 'ചരക്ക് ഗതാഗതം',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Tata_Ace_Mini_Truck_(1).JPG',
                official_link: 'https://smalltrucks.tatamotors.com/listing-page?field_product_category_target_id=1',
                specs: {
                    'എഞ്ചിൻ': '700 സിസി, 2 സിലിണ്ടറുകൾ',
                    'പേലോഡ്': '710 കിലോഗ്രാം',
                    'മൈലേജ്': '22 കി.മീ/ലിറ്റർ',
                    'ഇന്ധനം': 'ഡീസൽ / സിഎൻജി'
                },
                description: 'ടാറ്റ ഏസ് ഗോൾഡ് ചരക്ക് ഗതാഗതത്തിനായി രൂപകൽപ്പന ചെയ്ത ശക്തമായ വാഹനമാണ്. കുറഞ്ഞ അറ്റകുറ്റപ്പണിയും ഉയർന്ന കാര്യക്ഷമതയും ഉള്ളതിനാൽ ഇന്ത്യൻ കാർഷിക സാഹചര്യങ്ങൾക്ക് അനുയോജ്യമാണ്.'
            },
            {
                name: 'കുബോട്ട MU4501',
                type: 'ട്രാക്ടർ',
                price: '₹7.9 ലക്ഷം',
                purpose: 'ഇന്ധന ക്ഷമത',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Kubota_tractor_9.jpg',
                official_link: 'https://tractorguru.in/tractor/kubota-mu4501',
                specs: {
                    'എഞ്ചിൻ': '45 HP, 4 സിലിണ്ടറുകൾ',
                    'ട്രാൻസ്മിഷൻ': 'സിൻക്രോമേഷ്',
                    'PTO': 'ഡ്യുവൽ PTO',
                    'ബ്രേക്കുകൾ': 'ഓയിൽ ഇമ്മേഴ്സ്ഡ് ഡിസ്ക് ബ്രേക്കുകൾ'
                },
                description: 'കുബോട്ട MU4501 ഇന്ധന ക്ഷമതയ്ക്കായി രൂപകൽപ്പന ചെയ്ത ശക്തമായ ട്രാക്ടറാണ്. കുറഞ്ഞ അറ്റകുറ്റപ്പണിയും ഉയർന്ന കാര്യക്ഷമതയും ഉള്ളതിനാൽ ഇന്ത്യൻ കാർഷിക സാഹചര്യങ്ങൾക്ക് അനുയോജ്യമാണ്.'
            }
        ],
        bn: [
            {
                name: 'জন ডিয়ার 5310',
                type: 'ট্র্যাক্টর',
                price: '₹8.5 লাখ',
                purpose: 'ভারী চাষাবাদ',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/8/87/John_Deere_5310_utility_tractor,_rear.jpg',
                official_link: 'https://www.deere.co.in/en/tractors/e-series-tractors/5310e-tractor/',
                specs: {
                    'ইঞ্জিন': '55 HP, 3 সিলিন্ডার',
                    'গিয়ারবক্স': '9 ফরোয়ার্ড + 3 রিভার্স',
                    'ব্রেক': 'অয়েল ইমার্সড ডিস্ক ব্রেক',
                    'ওয়ারেন্টি': '5000 ঘণ্টা / 5 বছর'
                },
                description: 'জন ডিয়ার 5310 ভারী চাষাবাদের জন্য ডিজাইন করা একটি শক্তিশালী ট্রাক্টর। কম রক্ষণাবেক্ষণ এবং উচ্চ দক্ষতার সাথে ভারতীয় কৃষি পরিস্থিতির জন্য উপযুক্ত।'
            },
            {
                name: 'মহিন্দ্রা জিভো 245 DI 4WD',
                type: 'মিনি ট্রাক্টর',
                price: '₹4.2 লাখ',
                purpose: 'বাগানি চাষ',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Mahindra_tractor.JPG',
                official_link: 'https://www.mahindratractor.com/tractors/jivo-245-di-4wd',
                specs: {
                    'ইঞ্জিন': '24 HP, 2 সিলিন্ডার',
                    'গিয়ারবক্স': '8 ফরোয়ার্ড + 4 রিভার্স',
                    'ব্রেক': 'অয়েল ইমার্সড ব্রেক',
                    'লিফট ক্ষমতা': '750 কেজি'
                },
                description: 'মহিন্দ্রা জিভো 245 DI 4WD বাগানি চাষের জন্য ডিজাইন করা একটি শক্তিশালী মিনি ট্রাক্টর। কম রক্ষণাবেক্ষণ এবং উচ্চ দক্ষতার সাথে ভারতীয় কৃষি পরিস্থিতির জন্য উপযুক্ত।'
            },
            {
                name: 'সোনালিকা DI 745',
                type: 'ট্র্যাক্টর',
                price: '₹6.8 লাখ',
                purpose: 'পরিবহন ও চাষাবাদ',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/9/93/Sonalika_DI_tractor.jpg',
                official_link: 'https://www.sonalika.com/tractor/di-745-iii.html',
                specs: {
                    'إইঞ্জিন': '50 HP, 3 সিলিন্ডার',
                    'গিয়ারবক্স': '8 ফরোয়ার্ড + 2 রিভার্স',
                    'ক্লাচ': 'ডুয়াল ক্লাচ',
                    'স্টিয়ারিং': 'পাওয়ার স্টিয়ারিং'
                },
                description: 'সোনালিকা DI 745 পরিবহন ও চাষাবাদের জন্য ডিজাইন করা একটি শক্তিশালী ট্রাক্টর। কম রক্ষণাবেক্ষণ এবং উচ্চ দক্ষতার সাথে ভারতীয় কৃষি পরিস্থিতির জন্য উপযুক্ত।'
            },
            {
                name: 'টাটা এস গোল্ড',
                type: 'পরিবহন',
                price: '₹5.0 লাখ',
                purpose: 'পণ্য পরিবহন',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Tata_Ace_Mini_Truck_(1).JPG',
                official_link: 'https://smalltrucks.tatamotors.com/listing-page?field_product_category_target_id=1',
                specs: {
                    'ইঞ্জিন': '700 সিসি, 2 সিলিন্ডার',
                    'পেলোড': '710 কেজি',
                    'মাইলেজ': '22 কিমি/লিটার',
                    'জ্বালানি': 'ডিজেল / সিএনজি'
                },
                description: 'টাটা এস গোল্ড পণ্য পরিবহনের জন্য ডিজাইন করা একটি শক্তিশালী বাহন। কম রক্ষণাবেক্ষণ এবং উচ্চ দক্ষতার সাথে ভারতীয় কৃষি পরিস্থিতির জন্য উপযুক্ত।'
            },
            {
                name: 'কুবোটা MU4501',
                type: 'ট্র্যাক্টর',
                price: '₹7.9 লাখ',
                purpose: 'জ্বালানি সাশ্রয়ী',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Kubota_tractor_9.jpg',
                official_link: 'https://tractorguru.in/tractor/kubota-mu4501',
                specs: {
                    'ইঞ্জিন': '45 HP, 4 সিলিন্ডার',
                    'ট্রান্সমিশন': 'সিনক্রোমেশ',
                    'PTO': 'ডুয়াল PTO',
                    'ব্রেক': 'অয়েল ইমার্সড ডিস্ক ব্রেক'
                },
                description: 'কুবোটা MU4501 জ্বালানি সাশ্রয়ের জন্য ডিজাইন করা একটি শক্তিশালী ট্রাক্টর। কম রক্ষণাবেক্ষণ এবং উচ্চ দক্ষতার সাথে ভারতীয় কৃষি পরিস্থিতির জন্য উপযুক্ত।'
            }
        ],
        mr: [
            {
                name: 'जॉन डिअर 5310',
                type: 'ट्रॅक्टर',
                price: '₹8.5 लाख',
                purpose: 'जड नांगरणी',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/8/87/John_Deere_5310_utility_tractor,_rear.jpg',
                official_link: 'https://www.deere.co.in/en/tractors/e-series-tractors/5310e-tractor/',
                specs: {
                    'इंजिन': '55 HP, 3 सिलेंडर',
                    'गियरबॉक्स': '9 फॉरवर्ड + 3 रिव्हर्स',
                    'ब्रेक्स': 'ऑईल इमर्स्ड डिस्क ब्रेक्स',
                    'वारंटी': '5000 तास / 5 वर्षे'
                },
                description: 'जॉन डिअर 5310 जड नांगरणीसाठी डिझाइन केलेला एक शक्तिशाली ट्रॅक्टर आहे. कमी देखभाल आणि उच्च कार्यक्षमता, भारतीय शेतीसाठी योग्य.'
            },
            {
                name: 'महिंद्रा जीवो 245 DI 4WD',
                type: 'मिनी ट्रॅक्टर',
                price: '₹4.2 लाख',
                purpose: 'बागायती शेती',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Mahindra_tractor.JPG',
                official_link: 'https://www.mahindratractor.com/tractors/jivo-245-di-4wd',
                specs: {
                    'इंजिन': '24 HP, 2 सिलेंडर',
                    'गियरबॉक्स': '8 फॉरवर्ड + 4 रिव्हर्स',
                    'ब्रेक्स': 'ऑईल इमर्स्ड ब्रेक्स',
                    'लिफ्ट क्षमता': '750 किलो'
                },
                description: 'महिंद्रा जीवो 245 DI 4WD बागायती शेतीसाठी डिझाइन केलेला एक शक्तिशाली मिनी ट्रॅक्टर आहे. कमी देखभाल आणि उच्च कार्यक्षमता, भारतीय शेतीसाठी योग्य.'
            },
            {
                name: 'सोनालिका DI 745',
                type: 'ट्रॅक्टर',
                price: '₹6.8 लाख',
                purpose: 'वाहतूक आणि मशागत',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/9/93/Sonalika_DI_tractor.jpg',
                official_link: 'https://www.sonalika.com/tractor/di-745-iii.html',
                specs: {
                    'इंजिन': '50 HP, 3 सिलेंडर',
                    'गियरबॉक्स': '8 फॉरवर्ड + 2 रिव्हर्स',
                    'क्लच': 'ड्युअल क्लच',
                    'स्टीअरिंग': 'पॉवर स्टीअरिंग'
                },
                description: 'सोनालिका DI 745 वाहतूक आणि मशागतीसाठी डिझाइन केलेला एक शक्तिशाली ट्रॅक्टर आहे. कमी देखभाल आणि उच्च कार्यक्षमता, भारतीय शेतीसाठी योग्य.'
            },
            {
                name: 'टाटा एस गोल्ड',
                type: 'वाहतूक',
                price: '₹5.0 लाख',
                purpose: 'मालवाहतूक',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Tata_Ace_Mini_Truck_(1).JPG',
                official_link: 'https://smalltrucks.tatamotors.com/listing-page?field_product_category_target_id=1',
                specs: {
                    'इंजिन': '700 सीसी, 2 सिलेंडर',
                    'पेलोड': '710 किलो',
                    'मायलेज': '22 किमी/लि',
                    'इंधन': 'डिझेल / सीएनजी'
                },
                description: 'टाटा एस गोल्ड मालवाहतुकीसाठी डिझाइन केलेले एक शक्तिशाली वाहन आहे. कमी देखभाल आणि उच्च कार्यक्षमता, भारतीय शेतीसाठी योग्य.'
            },
            {
                name: 'कुबोटा MU4501',
                type: 'ट्रॅक्टर',
                price: '₹7.9 लाख',
                purpose: 'इंधन कार्यक्षम',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Kubota_tractor_9.jpg',
                official_link: 'https://tractorguru.in/tractor/kubota-mu4501',
                specs: {
                    'इंजिन': '45 HP, 4 सिलेंडर',
                    'ट्रान्समिशन': 'सिंक्रोमेश',
                    'PTO': 'ड्युअल PTO',
                    'ब्रेक्स': 'ऑईल इमर्स्ड डिस्क ब्रेक्स'
                },
                description: 'कुबोटा MU4501 इंधन कार्यक्षमतेसाठी डिझाइन केलेला एक शक्तिशाली ट्रॅक्टर आहे. कमी देखभाल आणि उच्च कार्यक्षमता, भारतीय शेतीसाठी योग्य.'
            }
        ],
        gu: [
            {
                name: 'જોન ડીઅર 5310',
                type: 'ટ્રેક્ટર',
                price: '₹8.5 લાખ',
                purpose: 'ભારે ખેડાણ',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/8/87/John_Deere_5310_utility_tractor,_rear.jpg',
                official_link: 'https://www.deere.co.in/en/tractors/e-series-tractors/5310e-tractor/',
                specs: {
                    'એન્જિન': '55 HP, 3 સિલિન્ડર',
                    'ગિયરબોક્સ': '9 ફોરવર્ડ + 3 રિવર્સ',
                    'બ્રેક્સ': 'ઓઇલ ઇમર્સ્ડ ડિસ્ક બ્રેક્સ',
                    'વોરંટી': '5000 કલાક / 5 વર્ષ'
                },
                description: 'જોન ડીઅર 5310 ભારે ખેડાણ માટે રચાયેલ શક્તિશાળી ટ્રેક્ટર છે. ઓછી જાળવણી અને ઉચ્ચ કાર્યક્ષમતા સાથે ભારતીય ખેતીની સ્થિતિ માટે યોગ્ય.'
            },
            {
                name: 'મહિન્દ્રા જીવો 245 DI 4WD',
                type: 'મિની ટ્રેક્ટર',
                price: '₹4.2 લાખ',
                purpose: 'બાગાયતી ખેતી',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Mahindra_tractor.JPG',
                official_link: 'https://www.mahindratractor.com/tractors/jivo-245-di-4wd',
                specs: {
                    'એન્જિન': '24 HP, 2 સિલિન્ડર',
                    'ગિયરબોક્સ': '8 ફોરવર્ડ + 4 રિવર્સ',
                    'બ્રેક્સ': 'ઓઇલ ઇમર્સ્ડ બ્રેક્સ',
                    'લિફ્ટ ક્ષમતા': '750 કિગ્રા'
                },
                description: 'મહિન્દ્રા જીવો 245 DI 4WD બાગાયતી ખેતી માટે રચાયેલ શક્તિશાળી મિની ટ્રેક્ટર છે. ઓછી જાળવણી અને ઉચ્ચ કાર્યક્ષમતા સાથે ભારતીય ખેતીની સ્થિતિ માટે યોગ્ય.'
            },
            {
                name: 'સોનાલિકા DI 745',
                type: 'ટ્રેક્ટર',
                price: '₹6.8 લાખ',
                purpose: 'વાહનવ્યવહાર અને ખેતી',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/9/93/Sonalika_DI_tractor.jpg',
                official_link: 'https://www.sonalika.com/tractor/di-745-iii.html',
                specs: {
                    'એન્જિન': '50 HP, 3 સિલિન્ડર',
                    'ગિયરબોક્સ': '8 ફોરવર્ડ + 2 રિવર્સ',
                    'ક્લચ': 'ડ્યુઅલ ક્લચ',
                    'સ્ટીયરિંગ': 'પાવર સ્ટીયરિંગ'
                },
                description: 'સોનાલિકા DI 745 વાહનવ્યવહાર અને ખેતી માટે રચાયેલ શક્તિશાળી ટ્રેક્ટર છે. ઓછી જાળવણી અને ઉચ્ચ કાર્યક્ષમતા સાથે ભારતીય ખેતીની સ્થિતિ માટે યોગ્ય.'
            },
            {
                name: 'ટાટા એસ ગોલ્ડ',
                type: 'વાહનવ્યવહાર',
                price: '₹5.0 લાખ',
                purpose: 'માલ વાહનવ્યવહાર',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/f/f3/Tata_Ace_Mini_Truck_(1).JPG',
                official_link: 'https://smalltrucks.tatamotors.com/listing-page?field_product_category_target_id=1',
                specs: {
                    'એન્જિન': '700 સીસી, 2 સિલિન્ડર',
                    'પેલોડ': '710 કિગ્રા',
                    'માઈલેજ': '22 કિમી/લિટર',
                    'ઇંધણ': 'ડીઝલ / સીએનજી'
                },
                description: 'ટાટા એસ ગોલ્ડ માલ વાહનવ્યવહાર માટે રચાયેલ શક્તિશાળી વાહન છે. ઓછી જાળવણી અને ઉચ્ચ કાર્યક્ષમતા સાથે ભારતીય ખેતીની સ્થિતિ માટે યોગ્ય.'
            },
            {
                name: 'કુબોટા MU4501',
                type: 'ટ્રેક્ટર',
                price: '₹7.9 લાખ',
                purpose: 'ઇંધણ કાર્યક્ષમ',
                image_url: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Kubota_tractor_9.jpg',
                official_link: 'https://tractorguru.in/tractor/kubota-mu4501',
                specs: {
                    'એન્જિન': '45 HP, 4 સિલિન્ડર',
                    'ટ્રાન્સમિશન': 'સિંક્રોમેશ',
                    'PTO': 'ડ્યુઅલ PTO',
                    'બ્રેક્સ': 'ઓઇલ ઇમર્સ્ડ ડિસ્ક બ્રેક્સ'
                },
                description: 'કુબોટા MU4501 ઇંધણ કાર્યક્ષમતા માટે રચાયેલ શક્તિશાળી ટ્રેક્ટર છે. ઓછી જાળવણી અને ઉચ્ચ કાર્યક્ષમતા સાથે ભારતીય ખેતીની સ્થિતિ માટે યોગ્ય.'
            }
        ],
    };

    const staticVehicles = vehicleTranslations[currentLanguage] || vehicleTranslations['en'];

    const vehicleLabels: { [key: string]: { specs: string, desc: string, visit: string, back: string } } = {
        en: { specs: 'Specifications', desc: 'Description', visit: 'Visit Official Page', back: 'Back' },
        ta: { specs: 'விவரக்குறிப்புகள்', desc: 'விளக்கம்', visit: 'அதிகாரப்பூர்வ பக்கத்தைப் பார்வையிடவும்', back: 'பின்னால்' },
        hi: { specs: 'विनिर्देश', desc: 'विवरण', visit: 'आधिकारिक पृष्ठ पर जाएं', back: 'वापस' },
        te: { specs: 'స్పెసిఫికేషన్లు', desc: 'వివరణ', visit: 'అధికారిక పేజీని సందర్శించండి', back: 'తిరిగి' },
        kn: { specs: 'ವಿಶೇಷಣಗಳು', desc: 'ವಿವರಣೆ', visit: 'ಅಧಿಕೃತ ಪುಟಕ್ಕೆ ಭೇಟಿ ನೀಡಿ', back: 'ಹಿಂದೆ' },
        ml: { specs: 'സവിശേഷതകൾ', desc: 'വിവരണം', visit: 'ഔദ്യോഗിക പേജ് സന്ദർശിക്കുക', back: 'തിരികെ' },
        bn: { specs: 'স্পেসিফিকেশন', desc: 'বিবরণ', visit: 'অফিসিয়াল পেজ দেখুন', back: 'ফিরে যান' },
        mr: { specs: 'तपशील', desc: 'वर्णन', visit: 'अधिकृत पृष्ठास भेट द्या', back: 'मागे' },
        gu: { specs: 'વિશિષ્ટતાઓ', desc: 'વર્ણન', visit: 'સત્તાવાર પૃષ્ઠની મુલાકાત લો', back: 'પાછા' }
    };

    const vLabels = vehicleLabels[currentLanguage] || vehicleLabels['en'];

    // Static Data for Schemes
    // Localized Data for Schemes
    const schemeData: { [key: string]: any[] } = {
        en: [
            { name: 'PM-KISAN', details: '₹6000/year income support for all landholding farmers.', eligibility: 'Small & Marginal Farmers', application_link: 'https://pmkisan.gov.in', youtube_link: 'https://youtu.be/vUkRxMt0X5A?si=SMZLlj8qmWoRAvl6' },
            { name: 'Fasal Bima Yojana', details: 'Crop insurance scheme for yield protection.', eligibility: 'All Farmers', application_link: 'https://pmfby.gov.in', youtube_link: 'https://www.youtube.com/watch?v=P_J6vS-6_C4' },
            { name: 'Kisan Credit Card', details: 'Affordable credit for agricultural needs.', eligibility: 'Farmers, Tenancts', application_link: 'https://sbi.co.in', youtube_link: 'https://youtu.be/Uld6joNKTms?si=l0kNicVxQZeUMuHg' },
            { name: 'e-NAM Scheme', details: 'Online trading platform for agricultural commodities.', eligibility: 'Traders & Farmers', application_link: 'https://enam.gov.in', youtube_link: 'https://www.youtube.com/watch?v=GV6TvgruDfr' },
        ],
        hi: [
            { name: 'पीएम-किसान', details: 'सभी किसान परिवारों को ₹6000/वर्ष की आय सहायता।', eligibility: 'छोटे और सीमांत किसान', application_link: 'https://pmkisan.gov.in', youtube_link: 'https://youtu.be/vUkRxMt0X5A?si=SMZLlj8qmWoRAvl6' },
            { name: 'फसल बीमा योजना', details: 'फसल की उपज सुरक्षा के लिए बीमा योजना।', eligibility: 'सभी किसान', application_link: 'https://pmfby.gov.in', youtube_link: 'https://youtu.be/r0nq1Xd2Wts?si=TUpr69yiJnGNXkFv' },
            { name: 'किसान क्रेडिट कार्ड', details: 'कृषि आवश्यकताओं के लिए किफायती ऋण।', eligibility: 'किसान, बटाईदार', application_link: 'https://sbi.co.in', youtube_link: 'https://www.youtube.com/watch?v=GU20Qcgs0i' },
            { name: 'ई-नाम योजना', details: 'कृषि वस्तुओं के लिए ऑनलाइन ट्रेडिंग प्लेटफॉर्म।', eligibility: 'व्यापारी और किसान', application_link: 'https://enam.gov.in', youtube_link: 'https://youtu.be/bp-dLB8nhjE?si=mzEF2-fIlAXBd_X6' },
        ],
        ta: [
            { name: 'பிஎம்-கிசான்', details: 'விவசாயிகளுக்கு ஆண்டுக்கு ₹6000 வருமான உதவி.', eligibility: 'சிறு மற்றும் குறு விவசாயிகள்', application_link: 'https://pmkisan.gov.in', youtube_link: 'https://youtu.be/MzVeflSjQOI?si=rkD-meXVVlDnzfoR' },
            { name: 'பயிர் காப்பீட்டு திட்டம்', details: 'மகசூல் பாதுகாப்புக்கான பயிர் காப்பீட்டு திட்டம்.', eligibility: 'அனைத்து விவசாயிகள்', application_link: 'https://pmfby.gov.in', youtube_link: 'https://youtu.be/50-QD0PQusk?si=l9uTds4FhO6FGFxg' },
            { name: 'கிசான் கிரெடிட் கார்டு', details: 'விவசாயத் தேவைகளுக்கு மலிவு வட்டியில் கடன்.', eligibility: 'விவசாயிகள்', application_link: 'https://sbi.co.in', youtube_link: 'https://youtu.be/XToFRtpnfP0?si=4EC664MVhcsz27B6' },
            { name: 'இ-நாம் திட்டம்', details: 'விவசாயப் பொருட்களுக்கான ஆன்லைன் வர்த்தக தளம்.', eligibility: 'வியாபாரிகள் மற்றும் விவசாயிகள்', application_link: 'https://enam.gov.in', youtube_link: 'https://youtu.be/gZ-onvVP0Ik?si=SCUNdr2Zq_2oTM_O' },
        ],
        te: [
            { name: 'PM-KISAN', details: 'రైతులకు ఏటా ₹6000 ఆదాయ మద్దతు.', eligibility: 'చిన్న & సన్నకారు రైతులు', application_link: 'https://pmkisan.gov.in', youtube_link: 'https://youtu.be/OiQRnrjRWEo?si=2r4Lrrjs57ae44la' },
            { name: 'Fasal Bima Yojana', details: 'పంట నష్టానికి బీమా పథకం.', eligibility: 'అందరూ రైతులు', application_link: 'https://pmfby.gov.in', youtube_link: 'https://youtu.be/h5Y2MwNmr-s?si=lLcUb3vysIxnxqa5' },
            { name: 'Kisan Credit Card', details: 'వ్యవసాయ అవసరాలకు తక్కువ వడ్డీ రుణాలు.', eligibility: 'రైతులు', application_link: 'https://sbi.co.in', youtube_link: 'https://youtu.be/ussXLrBWaSI?si=nHkCs3EFa1oCiuvW' },
            { name: 'e-NAM Scheme', details: 'వ్యవసాయ ఉత్పత్తుల ఆన్‌లైన్ ట్రేడింగ్ ప్లాట్‌ఫారమ్.', eligibility: 'వ్యాపారులు & రైతులు', application_link: 'https://enam.gov.in', youtube_link: 'https://youtu.be/gZ-onvVP0Ik?si=SCUNdr2Zq_2oTM_O' },
        ],
        kn: [
            { name: 'PM-KISAN', details: 'ರೈತರಿಗೆ ವರ್ಷಕ್ಕೆ ₹6000 ಆದಾಯ ಬೆಂಬಲ.', eligibility: 'ಸಣ್ಣ ಮತ್ತು ಅತಿ ಸಣ್ಣ ರೈತರು', application_link: 'https://pmkisan.gov.in', youtube_link: 'https://youtu.be/EuFPgYYc7A0?si=EqyW9FQJG6m7mB4S' },
            { name: 'Fasal Bima Yojana', details: 'ಬೆಳೆ ನಷ್ಟಕ್ಕೆ ವಿಮಾ ಯೋಜನೆ.', eligibility: 'ಎಲ್ಲಾ ರೈತರು', application_link: 'https://pmfby.gov.in', youtube_link: 'https://youtu.be/QIh_IlHq524?si=BYDLn8CxaoHvMPTO' },
            { name: 'Kisan Credit Card', details: 'ಕೃಷಿ ಸಾಲ ಸೌಲಭ್ಯ.', eligibility: 'ರೈತರು', application_link: 'https://sbi.co.in', youtube_link: 'https://youtu.be/IOjb6SlHWiE?si=ZOVvnzbfwfyrw4hQ' },
            { name: 'e-NAM Scheme', details: 'ಕೃಷಿ ಉತ್ಪನ್ನಗಳ ಆನ್‌ಲೈನ್ ಮಾರಾಟ.', eligibility: 'ವ್ಯಾಪಾರಿಗಳು ಮತ್ತು ರೈತರು', application_link: 'https://enam.gov.in', youtube_link: 'https://youtu.be/gZ-onvVP0Ik?si=SCUNdr2Zq_2oTM_O' },
        ],
        ml: [
            { name: 'PM-KISAN', details: 'കർഷകർക്ക് വർഷം ₹6000 ധനസഹായം.', eligibility: 'ചെറുകിട കർഷകർ', application_link: 'https://pmkisan.gov.in', youtube_link: 'https://youtu.be/SPIdJoOTAU8?si=0YXdMOiGfJ_c4klQ' },
            { name: 'Fasal Bima Yojana', details: 'വിള ഇൻഷുറൻസ് പദ്ധതി.', eligibility: 'എല്ലാ കർഷകർക്കും', application_link: 'https://pmfby.gov.in', youtube_link: 'https://youtu.be/ootyX325eDA?si=s0pShDUZx9DZwWtr' },
            { name: 'Kisan Credit Card', details: 'കാർഷിക വായ്പ പദ്ധതി.', eligibility: 'കർഷകർ', application_link: 'https://sbi.co.in', youtube_link: 'https://www.youtube.com/watch?v=9fIXiJNV9AU' },
            { name: 'e-NAM Scheme', details: 'ഓൺലൈൻ കാർഷിക വിപണി.', eligibility: 'കർഷകർ', application_link: 'https://enam.gov.in', youtube_link: 'https://youtu.be/gZ-onvVP0Ik?si=SCUNdr2Zq_2oTM_O' },
        ],
        bn: [
            { name: 'PM-KISAN', details: 'কৃষকদের জন্য বছরে ₹6000 আর্থিক সহায়তা।', eligibility: 'ক্ষুদ্র ও প্রান্তিক কৃষক', application_link: 'https://pmkisan.gov.in', youtube_link: 'https://www.youtube.com/watch?v=Sc4cM6n4oq0' },
            { name: 'Fasal Bima Yojana', details: 'শস্য বিমা যোজনা।', eligibility: 'সমস্ত কৃষক', application_link: 'https://pmfby.gov.in', youtube_link: 'https://youtu.be/mD2HX6oW97I?si=Uqk3aK3yiP3QfeSf' },
            { name: 'Kisan Credit Card', details: 'কৃষকদের জন্য ঋণ সুবিধা।', eligibility: 'কৃষক', application_link: 'https://sbi.co.in', youtube_link: 'https://youtu.be/gKEphl0JxK4?si=Vobh4xQ-hMYr68qh' },
            { name: 'e-NAM Scheme', details: 'অনলাইন কৃষি বাজার।', eligibility: 'ব্যবসায়ী ও কৃষক', application_link: 'https://enam.gov.in', youtube_link: 'https://youtu.be/bp-dLB8nhjE?si=mzEF2-fIlAXBd_X6' },
        ],
        mr: [
            { name: 'PM-KISAN', details: 'शेतकऱ्यांना वर्षाला ₹6000 आर्थिक मदत.', eligibility: 'अल्पभूधारक शेतकरी', application_link: 'https://pmkisan.gov.in', youtube_link: 'https://youtu.be/nmAWWOHlSKA?si=ruLJHdLqsCHsDPLR' },
            { name: 'Fasal Bima Yojana', details: 'पीक विमा योजना.', eligibility: 'सर्व शेतकरी', application_link: 'https://pmfby.gov.in', youtube_link: 'https://youtu.be/8D-kDKIkzEA?si=iWSWuiXkzgCcwYWA' },
            { name: 'Kisan Credit Card', details: 'शेतकऱ्यांसाठी कर्ज योजना.', eligibility: 'शेतकरी', application_link: 'https://sbi.co.in', youtube_link: 'https://youtu.be/k766_q17tOA?si=mFpFrMNGEXzMcJkp' },
            { name: 'e-NAM Scheme', details: 'ऑनलाईन कृषी बाजार.', eligibility: 'व्यापारी आणि शेतकरी', application_link: 'https://enam.gov.in', youtube_link: 'https://youtu.be/bp-dLB8nhjE?si=mzEF2-fIlAXBd_X6' },
        ],
        gu: [
            { name: 'PM-KISAN', details: 'ખેડૂતોને વર્ષે ₹6000 ની આર્થિક સહાય.', eligibility: 'નાના ખેડૂતો', application_link: 'https://pmkisan.gov.in', youtube_link: 'https://youtu.be/bF6BOCdzrtU?si=VbORuBm-7ixqRvkg' },
            { name: 'Fasal Bima Yojana', details: 'પાક વીમા યોજના.', eligibility: 'તમામ ખેડૂતો', application_link: 'https://pmfby.gov.in', youtube_link: 'https://youtu.be/fonnl2nDh30?si=QqR3Kus36w1ptBb7' },
            { name: 'Kisan Credit Card', details: 'ખેડૂતો માટે ધીરાણ યોજના.', eligibility: 'ખેડૂતો', application_link: 'https://sbi.co.in', youtube_link: 'https://youtu.be/vUkRxMt0X5A?si=SMZLlj8qmWoRAvl6' },
            { name: 'e-NAM Scheme', details: 'ઓનલાઇન કૃષિ બજાર.', eligibility: 'વેપારીઓ અને ખેડૂતો', application_link: 'https://enam.gov.in', youtube_link: 'https://youtu.be/bp-dLB8nhjE?si=mzEF2-fIlAXBd_X6' },
        ],
    };

    const staticSchemes = schemeData[currentLanguage] || schemeData['en'];

    const renderRates = () => (
        <div className="flex flex-col h-full animate-fade-in">
            {renderSearchBar("Search vegetable (e.g. Tomato)...", handleRateSearch)}

            {ratesResult ? (
                <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar min-h-0 flex items-center justify-center">
                    <div className="glass-panel p-8 rounded-3xl border-emerald-500/20 bg-emerald-500/5 w-full max-w-3xl">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-xl font-semibold text-emerald-400">Market Rate & Analysis</h3>
                            <button
                                onClick={() => playTTS(ratesResult.summary)}
                                className="p-2 hover:bg-emerald-500/20 rounded-full text-emerald-400 transition-colors"
                                title="Read Summary"
                            >
                                {playingText === ratesResult.summary ? <StopCircle className="w-6 h-6 animate-pulse" /> : <Volume2 className="w-6 h-6" />}
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-black/20 p-6 rounded-2xl border border-white/5">
                                <p className="text-xl font-medium text-white leading-relaxed whitespace-pre-wrap">{ratesResult.summary}</p>
                            </div>

                            <div className="mt-4">
                                <button
                                    onClick={() => {
                                        if (onMoreDetails) {
                                            onMoreDetails(searchTerm);
                                        } else {
                                            setShowRatesDetails(!showRatesDetails);
                                        }
                                    }}
                                    className="mt-4 text-sm font-bold uppercase tracking-wider text-emerald-400 hover:text-emerald-300 flex items-center gap-2 transition-colors"
                                >
                                    {onMoreDetails ? (
                                        <><ChevronDown className="w-4 h-4" /> More Details</>
                                    ) : showRatesDetails ? (
                                        <><ChevronUp className="w-4 h-4" /> Show Less</>
                                    ) : (
                                        <><ChevronDown className="w-4 h-4" /> More Details</>
                                    )}
                                </button>
                                {ratesResult.details && !onMoreDetails && showRatesDetails && (
                                    <div className="bg-white/5 p-6 rounded-2xl border border-white/10 animate-fade-in mt-2">
                                        <p className="text-gray-300 leading-relaxed text-base whitespace-pre-wrap">
                                            {ratesResult.details}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : !isLoading && (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500 opacity-50">
                    <Sprout className="w-16 h-16 mb-4" />
                    <p>Search for crops to see details</p>
                </div>
            )}
        </div>
    );

    const renderVehicles = () => (
        <div className="flex flex-col h-full animate-fade-in">
            {/* No Search Bar for Vehicles - Static List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-8 overflow-y-auto custom-scrollbar">
                {staticVehicles.map((v, i) => (
                    <div
                        key={i}
                        onClick={() => {
                            setSelectedVehicleIndex(i);
                            setView('vehicle_details');
                        }}
                        className="glass-panel p-0 rounded-2xl flex flex-col gap-0 border-blue-500/10 hover:bg-white/5 transition-all cursor-pointer overflow-hidden group"
                    >
                        <div className="h-48 w-full overflow-hidden relative">
                            <div className="absolute inset-0 bg-blue-900/20 z-0"></div>
                            <img src={v.image_url} alt={v.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 z-10" />
                            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-emerald-400 font-bold border border-white/10 z-20">
                                {v.price}
                            </div>
                        </div>
                        <div className="p-5 flex flex-col gap-2">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-lg text-blue-300">{v.name}</h3>
                                    <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-md">{v.type}</span>
                                </div>
                            </div>
                            <p className="text-sm text-gray-400">{v.purpose}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderVehicleDetails = () => {
        const selectedVehicle = selectedVehicleIndex !== null ? staticVehicles[selectedVehicleIndex] : null;
        return (
            <div className="flex flex-col h-full animate-fade-in pb-8 overflow-y-auto custom-scrollbar">
                {selectedVehicle && (
                    <div className="max-w-4xl mx-auto w-full">
                        <div className="glass-panel p-0 rounded-3xl overflow-hidden border-blue-500/20">
                            <div className="h-64 md:h-80 w-full relative">
                                <img src={selectedVehicle.image_url} alt={selectedVehicle.name} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
                                <div className="absolute bottom-0 left-0 w-full p-8">
                                    <h2 className="text-3xl font-bold text-white mb-2">{selectedVehicle.name}</h2>
                                    <div className="flex items-center gap-4">
                                        <span className="bg-emerald-500 text-black font-bold px-4 py-1.5 rounded-full">{selectedVehicle.price}</span>
                                        <span className="bg-blue-500/30 text-blue-200 border border-blue-500/30 px-3 py-1.5 rounded-full text-sm">{selectedVehicle.type}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div>
                                        <h3 className="text-xl font-bold text-blue-300 mb-4 flex items-center gap-2">
                                            <Truck className="w-5 h-5" /> {vLabels.specs}
                                        </h3>
                                        <div className="space-y-4">
                                            {Object.entries(selectedVehicle.specs).map(([key, value]) => (
                                                <div key={key} className="flex justify-between items-center border-b border-white/5 pb-2">
                                                    <span className="text-gray-400 capitalize">{key}</span>
                                                    <span className="text-white font-medium">{(value as string)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex flex-col justify-between">
                                        <div>
                                            <h3 className="text-xl font-bold text-blue-300 mb-4">{vLabels.desc}</h3>
                                            <p className="text-gray-300 leading-relaxed mb-6">
                                                {selectedVehicle.description}
                                            </p>
                                        </div>

                                        <a
                                            href={selectedVehicle.official_link}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 group"
                                        >
                                            {vLabels.visit} <ExternalLink className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderSchemes = () => (
        <div className="flex flex-col h-full animate-fade-in">
            {/* No Search Bar for Schemes - Static List */}
            <div className="grid grid-cols-1 gap-4 pb-8 overflow-y-auto custom-scrollbar">
                {staticSchemes.map((s, i) => (
                    <div key={i} className="glass-panel p-6 rounded-2xl border-amber-500/10 hover:bg-white/5 transition-all">
                        <div className="flex justify-between items-start mb-3">
                            <h3 className="font-bold text-lg text-amber-400">{s.name}</h3>
                            <div className="flex gap-2">
                                <button onClick={() => playTTS(`${s.name}. ${s.details}`)} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors">
                                    {playingText && playingText.startsWith(s.name) ? <StopCircle className="w-5 h-5 animate-pulse text-red-400" /> : <Volume2 className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                        <p className="text-gray-300 mb-4">{s.details}</p>
                        <div className="bg-black/20 p-4 rounded-xl text-sm border border-white/5 mb-4">
                            <span className="text-amber-500/80 font-bold block mb-1">Eligibility:</span>
                            {s.eligibility}
                        </div>
                        <div className="flex gap-3">
                            <a href={s.application_link} target="_blank" rel="noreferrer" className="flex-1 py-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-center text-sm font-medium transition-colors flex items-center justify-center gap-2">
                                <ExternalLink className="w-4 h-4" /> {labels.apply}
                            </a>
                            <button
                                onClick={() => window.open(s.youtube_link, '_blank')}
                                className="flex-1 py-2 bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/30 rounded-lg text-center text-sm font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                <Youtube className="w-4 h-4" /> {labels.watch}
                            </button>
                        </div>
                    </div>
                ))}
            </div>


        </div>
    );

    const renderMarketing = () => (
        <div className="flex flex-col h-full animate-fade-in">
            {renderSearchBar("Search topics (e.g. Organic)...", handleSearchMarketing)}

            <div className="grid grid-cols-1 gap-6 pb-8 overflow-y-auto custom-scrollbar">
                {stories.length === 0 && !isLoading ? (
                    <div className="text-center text-gray-500 py-10">No stories found. Try searching.</div>
                ) : (
                    stories.map((s, i) => (
                        <div key={i} className="glass-panel p-6 rounded-2xl border-pink-500/10 hover:bg-white/5 transition-all flex flex-col md:flex-row gap-6">
                            <div className="w-full md:w-1/3 bg-black/20 rounded-xl h-48 flex items-center justify-center text-gray-600 border border-white/5 relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-4">
                                    <span className="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">{s.image_prompt}</span>
                                </div>
                                <User className="w-12 h-12 opacity-20" />
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h3 className="font-bold text-xl text-pink-400">{s.name}</h3>
                                        <div className="text-sm text-gray-400 flex items-center gap-1">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                            {s.location}
                                        </div>
                                    </div>
                                    <button onClick={() => playTTS(s.content)} className="p-2 hover:bg-pink-500/20 rounded-full text-pink-400 transition-colors">
                                        {playingText === s.content ? <StopCircle className="w-5 h-5 animate-pulse" /> : <Volume2 className="w-5 h-5" />}
                                    </button>
                                </div>
                                <p className="text-gray-300 leading-relaxed text-sm md:text-base">{s.content}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    return (
        <div className="flex flex-col w-full max-w-6xl mx-auto h-[85vh] animate-slide-up my-auto">
            <header className="flex items-center gap-4 mb-6 shrink-0">
                <button onClick={() => {
                    if (view === 'vehicle_details') {
                        setView('vehicles');
                    } else if (view === 'menu') {
                        onBack();
                    } else {
                        setView('menu');
                    }
                }} className="p-2 rounded-full hover:bg-white/10 text-gray-400 transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h2 className="text-3xl font-bold">
                    {view === 'menu' ? (
                        <>{labels.marketHeader.split(' ')[0]} <span className="text-emerald-400">{labels.marketHeader.split(' ').slice(1).join(' ')}</span></>
                    ) : (
                        <span className="capitalize">{labels[view] || view.replace('-', ' ')}</span>
                    )}
                </h2>
            </header>

            <div className="flex-1 overflow-hidden">
                {view === 'menu' && <div className="h-full overflow-y-auto custom-scrollbar">{renderMenu()}</div>}
                {view === 'rates' && renderRates()}
                {view === 'vehicles' && renderVehicles()}
                {view === 'vehicle_details' && renderVehicleDetails()}
                {view === 'schemes' && renderSchemes()}
                {view === 'marketing' && renderMarketing()}
            </div>
        </div>
    );
};

export default MarketDashboard;
