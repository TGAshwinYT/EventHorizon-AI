import React, { useState, useEffect, useRef, memo } from 'react';
import { 
    Sprout, 
    Droplets, 
    CloudRain, 
    Wind, 
    Sun, 
    Cloud, 
    ArrowRight,
    Loader2,
    Newspaper,
    Calendar,
    AlertCircle
} from 'lucide-react';
import { centralSchemes } from '../utils/schemesData';

interface AgriDashboardProps {
    currentLanguage: string;
    userLocation: { state: string, district: string, mandal: string } | null;
    setActiveTab: (tab: any) => void;
    setAgriSubView?: (view: any) => void;
    token: string | null;
}

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

interface NewsItem {
    category: string;
    title: string;
    content: string;
    time: string;
    metric: string;
    source: string;
}

const dashboardTranslations: Record<string, Record<string, string>> = {
    en: {
        title: "Agri-Dashboard",
        welcome: "Welcome back, {name}",
        latestSchemes: "Latest Schemes",
        viewAllSchemes: "View All Schemes",
        dailyBenefitNews: "Daily Benefit News",
        weatherReport: "Weather Report",
        updatedJustNow: "Updated just now",
        quickActions: "Quick Actions",
        launchScanner: "Launch Crop Scanner",
        mandiPriceIntelligence: "Mandi Prices",
        farmRiskAssessment: "Risk Assessment",
        settingsAndProfile: "Profile & Settings",
        humidity: "Humidity",
        precipitation: "Precipitation",
        wind: "Wind",
        noNews: "Fetching latest news for your location...",
        tapForDetails: "Tap for details ↗",
        avoidSpraying: "Avoid Spraying",
        optimalConditions: "Optimal Conditions",
        highWindDelay: "High Wind - Delay Spraying",
        optimalIrrigation: "Optimal Irrigation",
        noNewsFound: "No news found at this moment."
    },
    ta: {
        title: "விவசாய டாஷ்போர்டு",
        welcome: "வருக, {name}",
        latestSchemes: "சமீபத்திய திட்டங்கள்",
        viewAllSchemes: "அனைத்து திட்டங்கள்",
        dailyBenefitNews: "தினசரி பயனுள்ள செய்திகள்",
        weatherReport: "வானிலை அறிக்கை",
        updatedJustNow: "இப்போது புதுப்பிக்கப்பட்டது",
        quickActions: "விரைவு இணைப்புகள்",
        launchScanner: "பயிர் ஸ்கேனரைத் தொடங்கு",
        mandiPriceIntelligence: "மண்டி விலை நிலவரம்",
        farmRiskAssessment: "பயிர் இடர் மதிப்பீடு",
        settingsAndProfile: "சுயவிவரம் & அமைப்புகள்",
        humidity: "ஈரப்பதம்",
        precipitation: "மழைப்பொழிவு",
        wind: "காற்று",
        noNews: "உங்கள் இருப்பிடத்திற்கான செய்திகள் பெறப்படுகின்றன...",
        tapForDetails: "மேலும் விபரங்கள் ↗",
        avoidSpraying: "மருந்து தெளிப்பதைத் தவிர்க்கவும்",
        optimalConditions: "சாதகமான சூழல்",
        highWindDelay: "பலத்த காற்று - தெளிப்பதைத் தள்ளிப்போடுங்கள்",
        optimalIrrigation: "சாதகமான நீர்ப்பாசனம்",
        noNewsFound: "செய்திகள் எதுவும் கிடைக்கவில்லை."
    },
    hi: {
        title: "कृषि डैशबोर्ड",
        welcome: "स्वागत है, {name}",
        latestSchemes: "नवीनतम योजनाएं",
        viewAllSchemes: "सभी योजनाएं देखें",
        dailyBenefitNews: "दैनिक लाभकारी समाचार",
        weatherReport: "मौसम रिपोर्ट",
        updatedJustNow: "अभी अपडेट किया गया",
        quickActions: "त्वरित कार्रवाई",
        launchScanner: "फसल स्कैनर लॉन्च करें",
        mandiPriceIntelligence: "मंडी मूल्य जानकारी",
        farmRiskAssessment: "कृषि जोखिम मूल्यांकन",
        settingsAndProfile: "प्रोफ़ाइल और सेटिंग्स",
        humidity: "आर्द्रता",
        precipitation: "वर्षा",
        wind: "हवा",
        noNews: "आपके स्थान के लिए समाचार प्राप्त किए जा रहे हैं...",
        tapForDetails: "विवरण के लिए टैप करें ↗",
        avoidSpraying: "छिड़काव से बचें",
        optimalConditions: "इष्टतम स्थितियाँ",
        highWindDelay: "तेज हवा - छिड़काव रोकें",
        optimalIrrigation: "इष्टतम सिंचाई",
        noNewsFound: "इस समय कोई समाचार नहीं मिला।"
    },
    te: {
        title: "వ్యవసాయ డాష్‌బోర్డ్",
        welcome: "స్వాగతం, {name}",
        latestSchemes: "తాజా పథకాలు",
        viewAllSchemes: "అన్ని పథకాలు చూడండి",
        dailyBenefitNews: "దినసరి ప్రయోజన వార్తలు",
        weatherReport: "వాతావరణ నివేదిక",
        updatedJustNow: "ఇప్పుడే నవీకరించబడింది",
        quickActions: "త్వరిత చర్యలు",
        launchScanner: "క్రాప్ స్కానర్ ప్రారంభించు",
        mandiPriceIntelligence: "మండీ ధరల సమాచారం",
        farmRiskAssessment: "వ్యవసాయ ప్రమాద అంచనా",
        settingsAndProfile: "ప్రొఫाइల్ & సెట్టింగ్లు",
        humidity: "తేమ",
        precipitation: "వర్షపాతం",
        wind: "గాలి",
        noNews: "మీ ప్రాంత తాజా వార్తలను సేకరిస్తోంది...",
        tapForDetails: "వివరాల కోసం నొక్కండి ↗",
        avoidSpraying: "స్ప్రే చేయడం నిలిపివేయండి",
        optimalConditions: "అనుకూల పరిస్థితులు",
        highWindDelay: "భారీ గాలి - స్ప్రేయింగ్ ఆలస్యం చేయండి",
        optimalIrrigation: "అనుకూల నీటి పారుదల",
        noNewsFound: "ప్రస్తుతం వార్తలేవీ లేవు."
    },
    kn: {
        title: "ಕೃಷಿ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
        welcome: "ಸ್ವಾಗತ, {name}",
        latestSchemes: "ಇತ್ತೀಚಿನ ಯೋಜನೆಗಳು",
        viewAllSchemes: "ಎಲ್ಲಾ ಯೋಜನೆಗಳನ್ನು ವೀಕ್ಷಿಸಿ",
        dailyBenefitNews: "ದೈನಂದಿನ ಪ್ರಯೋಜನಗಳ ಸುದ್ದಿ",
        weatherReport: "ಹವಾಮಾನ ವರದಿ",
        updatedJustNow: "ಈಗಷ್ಟೇ ನವೀಕರಿಸಲಾಗಿದೆ",
        quickActions: "ತ್ವರಿತ ಕ್ರಮಗಳು",
        launchScanner: "ಬೆಳೆ ಸ್ಕ್ಯಾನರ್ ಪ್ರಾರಂಭಿಸಿ",
        mandiPriceIntelligence: "ಮಾರುಕಟ್ಟೆ ಬೆಲೆ ಮಾಹಿತಿ",
        farmRiskAssessment: "ಕೃಷಿ ಅಪಾಯದ ಮೌಲ್ಯಮಾಪನ",
        settingsAndProfile: "ಪ್ರೊಫೈಲ್ ಮತ್ತು ಸೆಟ್ಟಿಂಗ್ಸ್",
        humidity: "ಆರ್ದ್ರತೆ",
        precipitation: "ಮಳೆ ಸಂಭವನೀಯತೆ",
        wind: "ಗಾಳಿ",
        noNews: "ನಿಮ್ಮ ಸ್ಥಳದ ಇತ್ತೀಚಿನ ಸುದ್ದಿಗಳನ್ನು ಪಡೆಯಲಾಗುತ್ತಿದೆ...",
        tapForDetails: "ವಿವರಗಳಿಗಾಗಿ ಟ್ಯಾಪ್ ಮಾಡಿ ↗",
        avoidSpraying: "ಸಿಂಪರಣೆ ಮಾಡಬೇಡಿ",
        optimalConditions: "ಅತ್ಯುತ್ತಮ ಪರಿಸ್ಥಿತಿಗಳು",
        highWindDelay: "ವೇಗದ ಗಾಳಿ - ಸಿಂಪರಣೆ ವಿಳಂಬಗೊಳಿಸಿ",
        optimalIrrigation: "ಅತ್ಯುತ್ತಮ ನೀರಾವರಿ",
        noNewsFound: "ಯಾವುದೇ ಸುದ್ದಿ ಲಭ್ಯವಿಲ್ಲ."
    },
    ml: {
        title: "കാർഷിക ഡാഷ്‌ബോർഡ്",
        welcome: "സ്വാഗതം, {name}",
        latestSchemes: "ഏറ്റവും പുതിയ പദ്ധതികൾ",
        viewAllSchemes: "എല്ലാ പദ്ധതികളും കാണുക",
        dailyBenefitNews: "ദിനസരി വാർത്തകൾ",
        weatherReport: "കാലാവസ്ഥ റിപ്പോർട്ട്",
        updatedJustNow: "ഇപ്പോൾ അപ്‌ഡേറ്റ് ചെയ്‌തത്",
        quickActions: "ദ്രുത ലിങ്കുകൾ",
        launchScanner: "ക്രോപ്പ് സ്കാനർ തുടങ്ങുക",
        mandiPriceIntelligence: "വിപണി വില വിവരങ്ങൾ",
        farmRiskAssessment: "കാർഷിക റിസ്ക് വിലയിരുത്തൽ",
        settingsAndProfile: "പ്രൊഫൈലും ക്രമീകരണങ്ങളും",
        humidity: "ആർദ്രത",
        precipitation: "മഴ സാധ്യത",
        wind: "കാറ്റ്",
        noNews: "വാർത്തകൾ ശേഖരിക്കുന്നു...",
        tapForDetails: "വിശദാംശങ്ങൾക്ക് ടാപ്പ് ചെയ്യുക ↗",
        avoidSpraying: "മരുന്ന് തളിക്കുന്നത് ഒഴിവാക്കുക",
        optimalConditions: "അനുകൂല സാഹചര്യം",
        highWindDelay: "ശക്തമായ കാറ്റ് - തളിക്കുന്നത് വൈകിപ്പിക്കുക",
        optimalIrrigation: "അനുകൂല ജലസേചനം",
        noNewsFound: "വാർത്തകൾ ഒന്നും ലഭ്യമല്ല."
    },
    bn: {
        title: "কৃষি ড্যাশবোর্ড",
        welcome: "স্বাগতম, {name}",
        latestSchemes: "সাম্প্রতিক প্রকল্পসমূহ",
        viewAllSchemes: "সব প্রকল্প দেখুন",
        dailyBenefitNews: "দৈনিক উপকারী খবর",
        weatherReport: "আবহাওয়া রিপোর্ট",
        updatedJustNow: "এইমাত্র আপডেট করা হয়েছে",
        quickActions: "দ্রুত অ্যাকশন",
        launchScanner: "ক্রপ স্ক্যানার চালু করুন",
        mandiPriceIntelligence: "মন্ডি মূল্য তথ্য",
        farmRiskAssessment: "খামার ঝুঁকি মূল্যায়ন",
        settingsAndProfile: "প্রোফাইল ও সেটিংস",
        humidity: "আর্দ্রতা",
        precipitation: "বৃষ্টির সম্ভাবনা",
        wind: "বাতাস",
        noNews: "আপনার অঞ্চলের জন্য খবর খোঁজা হচ্ছে...",
        tapForDetails: "বিস্তারিত দেখুন ↗",
        avoidSpraying: "স্প্রে করা এড়িয়ে চলুন",
        optimalConditions: "অনুকূল পরিস্থিতি",
        highWindDelay: "উচ্চ বাতাস - স্প্রে বিলম্ব করুন",
        optimalIrrigation: "অনুকূল সেচ ব্যবস্থা",
        noNewsFound: "কোন খবর পাওয়া যায়নি।"
    },
    mr: {
        title: "कृषी डॅशबोर्ड",
        welcome: "स्वागत आहे, {name}",
        latestSchemes: "नवीनतम योजना",
        viewAllSchemes: "सर्व योजना पहा",
        dailyBenefitNews: "दैनिक फायदेशीर बातम्या",
        weatherReport: "हवामान अहवाल",
        updatedJustNow: "आत्ताच अद्ययावत केले",
        quickActions: "त्वरित कृती",
        launchScanner: "क्रॉप स्कॅनर सुरू करा",
        mandiPriceIntelligence: "मंडी किंमत माहिती",
        farmRiskAssessment: "शेती जोखीम मूल्यांकन",
        settingsAndProfile: "प्रोफाइल आणि सेटिंग्ज",
        humidity: "आर्द्रता",
        precipitation: "पावसाची शक्यता",
        wind: "वारा",
        noNews: "तुमच्या भागातील बातम्या आणत आहे...",
        tapForDetails: "तपशीलासाठी टॅप करा ↗",
        avoidSpraying: "फवारणी टाळा",
        optimalConditions: "योग्य हवामान",
        highWindDelay: "वेगवान वारा - फवारणी पुढे ढकला",
        optimalIrrigation: "योग्य सिंचन",
        noNewsFound: "सध्या कोणतीही बातमी उपलब्ध नाही."
    }
};

// Custom hook for interaction-aware auto-scrolling
const useAutoScroll = (
    ref: React.RefObject<HTMLDivElement | null>,
    delay = 3500,
    step = 340,
    dependencies: any[] = []
) => {
    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        let intervalId: NodeJS.Timeout;
        let resumeTimeoutId: NodeJS.Timeout;
        let isPaused = false;

        const startScroll = () => {
            if (intervalId) clearInterval(intervalId);
            intervalId = setInterval(() => {
                if (isPaused) return;
                if (el.scrollWidth <= el.clientWidth) return;
                
                if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 25) {
                    el.scrollTo({ left: 0, behavior: 'smooth' });
                } else {
                    el.scrollBy({ left: step, behavior: 'smooth' });
                }
            }, delay);
        };

        const pauseAutoScroll = () => {
            isPaused = true;
            if (intervalId) clearInterval(intervalId);
        };

        const resumeAutoScroll = () => {
            isPaused = false;
            startScroll();
        };

        const handleInteraction = () => {
            pauseAutoScroll();
            if (resumeTimeoutId) clearTimeout(resumeTimeoutId);
            resumeTimeoutId = setTimeout(() => {
                resumeAutoScroll();
            }, 8000); // Resume auto-scrolling after 8 seconds of inactivity
        };

        startScroll();

        const handleMouseEnter = () => {
            pauseAutoScroll();
            if (resumeTimeoutId) clearTimeout(resumeTimeoutId);
        };
        const handleMouseLeave = () => {
            resumeAutoScroll();
        };

        el.addEventListener('mouseenter', handleMouseEnter);
        el.addEventListener('mouseleave', handleMouseLeave);
        el.addEventListener('touchstart', handleInteraction, { passive: true });
        el.addEventListener('mousedown', handleInteraction, { passive: true });
        el.addEventListener('wheel', handleInteraction, { passive: true });

        return () => {
            clearInterval(intervalId);
            clearTimeout(resumeTimeoutId);
            el.removeEventListener('mouseenter', handleMouseEnter);
            el.removeEventListener('mouseleave', handleMouseLeave);
            el.removeEventListener('touchstart', handleInteraction);
            el.removeEventListener('mousedown', handleInteraction);
            el.removeEventListener('wheel', handleInteraction);
        };
    }, [ref, delay, step, ...dependencies]);
};

const AgriDashboard = memo(({ currentLanguage, userLocation, setActiveTab, setAgriSubView, token }: AgriDashboardProps) => {
    const defaultState = userLocation?.state || 'Tamil Nadu';
    const defaultDistrict = userLocation?.district || 'Coimbatore';
    const displayName = sessionStorage.getItem('display_name') || 'Farmer';

    const trans = dashboardTranslations[currentLanguage] || dashboardTranslations['en'];

    // 1. Data States
    const [weatherForecast, setWeatherForecast] = useState<WeatherDay[]>([]);
    const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
    const [weatherLoading, setWeatherLoading] = useState(true);
    const [newsLoading, setNewsLoading] = useState(true);
    const [weatherError, setWeatherError] = useState<string | null>(null);

    // 2. References for horizontal scrolling
    const schemesScrollRef = useRef<HTMLDivElement>(null);
    const newsScrollRef = useRef<HTMLDivElement>(null);

    // 3. Prepare Latest Schemes sorted by dateAdded descending
    const sortedSchemes = React.useMemo(() => {
        return Object.values(centralSchemes).sort((a, b) => {
            return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
        });
    }, []);

    // 4. Fetch Weather (7 days)
    useEffect(() => {
        const fetchWeather = async () => {
            setWeatherLoading(true);
            setWeatherError(null);
            try {
                let url = `/api/weather?state=${encodeURIComponent(defaultState)}&district=${encodeURIComponent(defaultDistrict)}`;
                if (userLocation?.mandal) {
                    url += `&place=${encodeURIComponent(userLocation.mandal)}`;
                }
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error("Failed to load weather");
                }
                const data = await response.json();
                setWeatherForecast(data);
            } catch (err: any) {
                console.error("Error fetching weather forecast:", err);
                setWeatherError(err.message || "Failed to load weather");
            } finally {
                setWeatherLoading(false);
            }
        };
        fetchWeather();
    }, [defaultState, defaultDistrict, userLocation?.mandal]);

    // 5. Fetch Daily News (location-based via backend)
    useEffect(() => {
        const fetchNews = async () => {
            setNewsLoading(true);
            try {
                const response = await fetch('/api/news/daily', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token || ''}`
                    },
                    body: JSON.stringify({
                        state: defaultState,
                        district: defaultDistrict,
                        language: currentLanguage
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    setNewsItems(data);
                } else {
                    console.error("Failed to load news, status:", response.status);
                }
            } catch (err) {
                console.error("Error fetching daily news:", err);
            } finally {
                setNewsLoading(false);
            }
        };
        fetchNews();
    }, [defaultState, defaultDistrict, currentLanguage, token]);

    // 6. Generic loop-back auto-scroll hook logic
    useAutoScroll(schemesScrollRef, 4000, 320, [sortedSchemes]);
    useAutoScroll(newsScrollRef, 4500, 360, [newsItems]);

    // Weather Icon renderer
    const renderWeatherIcon = (iconType: string, className = "w-10 h-10") => {
        switch (iconType) {
            case 'sun': return <Sun className={`${className} text-yellow-400`} fill="currentColor" />;
            case 'cloudy': return <Cloud className={`${className} text-slate-400`} fill="currentColor" />;
            case 'partly-cloudy': return (
                <div className={`relative ${className}`}>
                    <Sun className="w-2/3 h-2/3 text-yellow-400 absolute top-0 right-0" fill="currentColor" />
                    <Cloud className="w-4/5 h-4/5 text-slate-300 absolute bottom-0 left-0" fill="currentColor" />
                </div>
            );
            case 'rain': return <CloudRain className={`${className} text-sky-400`} fill="currentColor" />;
            default: return <Sun className={`${className} text-yellow-400`} fill="currentColor" />;
        }
    };

    // Current weather calculations from forecast list
    const currentWeather = weatherForecast[0];

    return (
        <div className="flex-1 w-full px-6 py-6 md:px-8 md:py-8 lg:pt-20 overflow-y-auto pb-24 lg:pb-8 flex flex-col justify-start relative select-none">
            {/* Ambient Background Lights */}
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[radial-gradient(circle,_rgba(16,185,129,0.06)_0%,_transparent_70%)] pointer-events-none -translate-y-1/3 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[radial-gradient(circle,_rgba(59,130,246,0.06)_0%,_transparent_70%)] pointer-events-none translate-y-1/3 -translate-x-1/3" />

            {/* Welcome Banner */}
            <div className="flex flex-col mb-8 relative z-10">
                <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
                    {trans.welcome.replace('{name}', displayName)}
                </h1>
                <p className="text-slate-400 mt-2 text-sm md:text-base">
                    {defaultDistrict}, {defaultState} • {new Date().toLocaleDateString(currentLanguage, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
            </div>

            {/* Dashboard Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start relative z-10 w-full">
                
                {/* Left Side: Schemes and News (2 columns on lg screens) */}
                <div className="lg:col-span-2 flex flex-col gap-8 min-w-0">
                    
                    {/* Latest Schemes Widget */}
                    <div className="flex flex-col w-full">
                        <div className="flex justify-between items-center mb-4 px-1">
                            <h2 className="text-xl md:text-2xl font-bold text-white tracking-wide flex items-center gap-2">
                                <Sprout className="w-6 h-6 text-emerald-400" />
                                {trans.latestSchemes}
                            </h2>
                            <button 
                                onClick={() => {
                                    if (setAgriSubView) setAgriSubView('schemes');
                                    setActiveTab('agriculture');
                                }}
                                className="text-emerald-400 text-xs md:text-sm font-semibold hover:text-emerald-300 transition flex items-center gap-1 hover:underline"
                            >
                                {trans.viewAllSchemes}
                                <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* Scrolling Container */}
                        <div 
                            ref={schemesScrollRef}
                            className="flex flex-row items-stretch gap-4 overflow-x-auto pb-2 scrollbar-none cursor-grab active:cursor-grabbing"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        >
                            {sortedSchemes.map((scheme) => {
                                const localName = scheme.name[currentLanguage] || scheme.name['en'];
                                const localDetails = scheme.details[currentLanguage] || scheme.details['en'];
                                
                                return (
                                    <div 
                                        key={scheme.id}
                                        onClick={() => {
                                            if (setAgriSubView) setAgriSubView('schemes');
                                            setActiveTab('agriculture');
                                        }}
                                        className={`flex flex-col justify-between bg-slate-900/85 border border-white/5 rounded-2xl p-5 min-w-[280px] max-w-[280px] md:min-w-[320px] md:max-w-[320px] hover:border-emerald-500/30 hover:bg-slate-900/95 transition-all duration-300 hover:-translate-y-0.5`}
                                    >
                                        <div>
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-xs font-bold text-emerald-400 tracking-wider bg-emerald-500/10 px-2.5 py-1 rounded-full uppercase">
                                                    {scheme.category}
                                                </span>
                                                <span className="text-[10px] text-slate-500 font-medium">
                                                    {scheme.dateAdded === '2026-06-01' ? 'New' : 'Active'}
                                                </span>
                                            </div>
                                            
                                            <h3 className="text-base font-bold text-white mb-2 leading-snug line-clamp-1">
                                                {localName}
                                            </h3>
                                            
                                            <p className="text-slate-400 text-xs leading-relaxed line-clamp-3 mb-4">
                                                {localDetails}
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/5 text-[11px]">
                                            <span className="text-slate-400 font-medium">
                                                Benefit: <strong className="text-white font-semibold">{scheme.benefit[currentLanguage] || scheme.benefit['en']}</strong>
                                            </span>
                                            <span className="text-emerald-400 font-bold hover:underline cursor-pointer">
                                                {trans.tapForDetails}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Daily Benefit News Widget */}
                    <div className="flex flex-col w-full">
                        <div className="mb-4 px-1">
                            <h2 className="text-xl md:text-2xl font-bold text-white tracking-wide flex items-center gap-2">
                                <Newspaper className="w-6 h-6 text-sky-400" />
                                {trans.dailyBenefitNews}
                            </h2>
                        </div>

                        {/* Scrolling Container */}
                        <div 
                            ref={newsScrollRef}
                            className="flex flex-row items-stretch gap-4 overflow-x-auto pb-2 scrollbar-none cursor-grab active:cursor-grabbing"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        >
                            {newsLoading ? (
                                Array.from({ length: 3 }).map((_, idx) => (
                                    <div 
                                        key={`news-skel-${idx}`}
                                        className="bg-slate-900/85 border border-white/5 rounded-2xl p-5 min-w-[280px] max-w-[280px] md:min-w-[320px] md:max-w-[320px] h-[180px] animate-pulse flex flex-col justify-between"
                                    >
                                        <div className="space-y-3">
                                            <div className="h-4 bg-white/10 rounded w-1/3"></div>
                                            <div className="h-5 bg-white/10 rounded w-5/6"></div>
                                            <div className="h-3 bg-white/10 rounded w-full"></div>
                                        </div>
                                        <div className="h-3 bg-white/10 rounded w-2/3"></div>
                                    </div>
                                ))
                            ) : newsItems.length === 0 ? (
                                <div className="bg-slate-900/85 border border-white/5 rounded-2xl p-6 w-full flex items-center gap-3">
                                    <AlertCircle className="w-5 h-5 text-slate-500" />
                                    <span className="text-slate-400 text-sm">{trans.noNewsFound}</span>
                                </div>
                            ) : (
                                newsItems.map((news, idx) => (
                                    <div 
                                        key={idx}
                                        className="flex flex-col justify-between bg-slate-900/85 border border-white/5 rounded-2xl p-5 min-w-[280px] max-w-[280px] md:min-w-[340px] md:max-w-[340px] hover:border-sky-500/30 hover:bg-slate-900/95 transition-all duration-300 hover:-translate-y-0.5"
                                    >
                                        <div>
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="text-xs font-bold text-sky-400 tracking-wider bg-sky-500/10 px-2.5 py-1 rounded-full uppercase">
                                                    {news.category}
                                                </span>
                                                <span className="text-[10px] text-slate-500 font-medium">
                                                    {news.time}
                                                </span>
                                            </div>
                                            
                                            <h3 className="text-base font-bold text-white mb-2 leading-snug line-clamp-1">
                                                {news.title}
                                            </h3>
                                            
                                            <p className="text-slate-400 text-xs leading-relaxed line-clamp-3 mb-4">
                                                {news.content}
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/5 text-[11px]">
                                            <span className="text-slate-400 font-medium">
                                                Tag: <strong className="text-white font-semibold">{news.metric}</strong>
                                            </span>
                                            <span className="text-slate-500 text-[10px]">
                                                Source: {news.source}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Side: Weather Card and Quick actions */}
                <div className="flex flex-col gap-6 lg:gap-8">
                    
                    {/* WEATHER CARD */}
                    <div className="bg-[#111318] border border-white/5 rounded-3xl p-6 flex flex-col relative overflow-hidden shadow-2xl">
                        <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-[radial-gradient(circle,_rgba(16,185,129,0.06)_0%,_transparent_70%)] pointer-events-none" />

                        {weatherLoading ? (
                            <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
                                <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                                <span className="text-slate-400 text-xs">Loading Weather Forecast...</span>
                            </div>
                        ) : weatherError || !currentWeather ? (
                            <div className="flex flex-col items-center justify-center min-h-[300px] gap-2 text-center">
                                <AlertCircle className="w-8 h-8 text-red-400" />
                                <span className="text-slate-300 text-sm">Failed to retrieve weather</span>
                                <span className="text-slate-500 text-xs">{weatherError || "Service unreachable"}</span>
                            </div>
                        ) : (
                            <>
                                {/* Weather Header */}
                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">{trans.weatherReport}</h3>
                                        <span className="text-[10px] text-slate-500">{trans.updatedJustNow}</span>
                                    </div>
                                    <div className="text-xs text-[#00FF7F] font-bold bg-[#00FF7F]/10 px-2 py-0.5 rounded-full">
                                        {userLocation?.mandal ? `${userLocation.mandal}, ${defaultDistrict}` : defaultDistrict}
                                    </div>
                                </div>

                                {/* Current Temperature Block */}
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-5xl md:text-6xl font-extrabold text-white tracking-tight">{currentWeather.tempMax}</span>
                                        <span className="text-2xl text-slate-400">°C</span>
                                    </div>
                                    <div className="bg-slate-900/80 border border-white/5 p-3 rounded-2xl">
                                        {renderWeatherIcon(currentWeather.icon, "w-12 h-12")}
                                    </div>
                                </div>

                                {/* Small metrics grid */}
                                <div className="grid grid-cols-3 gap-3 mb-6">
                                    <div className="bg-slate-900/40 border border-white/5 rounded-xl p-2.5 flex flex-col items-center text-center">
                                        <Droplets className="w-4 h-4 text-sky-400 mb-1" />
                                        <span className="text-[10px] text-slate-500">{trans.humidity}</span>
                                        <span className="text-xs font-bold text-white mt-0.5">{currentWeather.humidity}%</span>
                                    </div>
                                    <div className="bg-slate-900/40 border border-white/5 rounded-xl p-2.5 flex flex-col items-center text-center">
                                        <CloudRain className="w-4 h-4 text-blue-400 mb-1" />
                                        <span className="text-[10px] text-slate-500">Rain</span>
                                        <span className="text-xs font-bold text-white mt-0.5">{currentWeather.rainProb}%</span>
                                    </div>
                                    <div className="bg-slate-900/40 border border-white/5 rounded-xl p-2.5 flex flex-col items-center text-center">
                                        <Wind className="w-4 h-4 text-slate-400 mb-1" />
                                        <span className="text-[10px] text-slate-500">{trans.wind}</span>
                                        <span className="text-xs font-bold text-white mt-0.5 leading-none">{currentWeather.windSpeed} km/h</span>
                                    </div>
                                </div>

                                {/* Crop spraying advisor warning */}
                                <div className="mb-6 p-3 rounded-xl border border-dashed border-white/10 text-center bg-slate-900/20">
                                    {currentWeather.windSpeed > 15 ? (
                                        <span className="text-xs font-bold text-amber-400 flex items-center justify-center gap-1.5">
                                            <AlertCircle className="w-4 h-4 shrink-0" />
                                            {trans.highWindDelay}
                                        </span>
                                    ) : (
                                        <span className="text-xs font-bold text-[#00FF7F] flex items-center justify-center gap-1.5">
                                            <Sun className="w-4 h-4 shrink-0" fill="currentColor" />
                                            {trans.optimalIrrigation}
                                        </span>
                                    )}
                                </div>

                                {/* Divider */}
                                <div className="border-t border-white/5 my-2" />

                                {/* 7-DAY SIDEWARDS WEATHER FORECAST BAR */}
                                <div className="mt-4">
                                    <h4 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                                        7-Day Forecast
                                    </h4>

                                    <div 
                                        className="flex flex-row gap-3 overflow-x-auto pb-2 scrollbar-none"
                                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                                    >
                                        {weatherForecast.slice(1).map((day, idx) => (
                                            <div 
                                                key={idx}
                                                className="bg-slate-900/50 border border-white/5 rounded-xl p-3 min-w-[90px] text-center flex flex-col items-center justify-between hover:bg-slate-900/80 transition"
                                            >
                                                <span className="text-[10px] text-slate-400 font-semibold block mb-2 whitespace-nowrap">
                                                    {day.date.split(',')[0]}
                                                </span>
                                                <div className="mb-2">
                                                    {renderWeatherIcon(day.icon, "w-6 h-6")}
                                                </div>
                                                <span className="text-[11px] font-bold text-white block">
                                                    {day.tempMax}°
                                                </span>
                                                <span className="text-[9px] text-slate-500 block">
                                                    Rain: {day.rainProb}%
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});

export default AgriDashboard;
