import { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import LanguageSelector from './components/LanguageSelector';

import MarketDashboard from './components/MarketDashboard';
import SkillsDashboard from './components/SkillsDashboard';
import Settings from './components/Settings';
import Auth from './components/Auth';
import { AlertCircle } from 'lucide-react';
import ChatBox from './components/ChatBox';
import InteractiveAIInput from './components/InteractiveAIInput';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'ai';
    timestamp: Date;
}

interface ProfileUpdate {
    displayName?: string;
    avatarUrl?: string;
}

function App() {
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [username, setUsername] = useState<string | null>(localStorage.getItem('username'));
    const [displayName, setDisplayName] = useState<string | null>(localStorage.getItem('display_name'));
    const [avatarUrl, setAvatarUrl] = useState<string | null>(localStorage.getItem('avatar_url'));

    const [voiceStatus, setVoiceStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');

    const [language, setLanguage] = useState(localStorage.getItem('language') || 'en');

    // Save language preference whenever it changes
    useEffect(() => {
        localStorage.setItem('language', language);
    }, [language]);
    const [connectionError, setConnectionError] = useState(false);
    const [activeTab, setActiveTab] = useState<'home' | 'agriculture' | 'skills' | 'settings'>('home');

    const [courses, setCourses] = useState<any[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Check auth on mount
    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('username');
        const storedDisplayName = localStorage.getItem('display_name');
        const storedAvatarUrl = localStorage.getItem('avatar_url');
        if (storedToken) {
            setToken(storedToken);
            setUsername(storedUser);
            setDisplayName(storedDisplayName);
            setAvatarUrl(storedAvatarUrl);
        }
    }, []);

    useEffect(() => {
        if (!token) return;

        const fetchData = async () => {
            try {
                const headers = { 'Authorization': `Bearer ${token}` };
                const [coursesRes, historyRes, profileRes] = await Promise.all([
                    fetch(`/api/market/courses?language=${language}`),
                    fetch('/api/chat/history', { headers }),
                    fetch('/api/auth/profile', { headers })
                ]);

                if (historyRes.status === 401 || profileRes.status === 401) {
                    console.log("Token expired or invalid. Logging out.");
                    handleLogout();
                    return;
                }

                const coursesJson = await coursesRes.json();
                const historyJson = await historyRes.json();
                const profileJson = await profileRes.json();

                setCourses(coursesJson);
                if (profileJson.display_name) {
                    setDisplayName(profileJson.display_name);
                    localStorage.setItem('display_name', profileJson.display_name);
                }
                if (profileJson.avatar_url) {
                    setAvatarUrl(profileJson.avatar_url);
                    try {
                        localStorage.setItem('avatar_url', profileJson.avatar_url);
                    } catch (e) {
                        console.warn('Could not save avatar to localStorage (quota exceeded)');
                    }
                }

                if (Array.isArray(historyJson)) {
                    const parsedHistory = historyJson.map((msg: any) => ({
                        ...msg,
                        timestamp: new Date(msg.timestamp)
                    }));
                    setMessages(parsedHistory);
                }
            } catch (err) {
                console.error("Failed to fetch data:", err);
            }
        };
        fetchData();

        // Ensure voices are loaded for TTS
        if ('speechSynthesis' in window) {
            window.speechSynthesis.getVoices();
            window.speechSynthesis.onvoiceschanged = () => {
                console.log("Voices loaded:", window.speechSynthesis.getVoices().length);
            };
        }
    }, [token, language]);

    const handleLogin = (newToken: string, newUsername: string) => {
        localStorage.setItem('token', newToken);
        localStorage.setItem('username', newUsername);
        setToken(newToken);
        setUsername(newUsername);
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('display_name');
        localStorage.removeItem('avatar_url');
        setToken(null);
        setUsername(null);
        setDisplayName(null);
        setAvatarUrl(null);
        setMessages([]);
    };

    // Localization for UI status messages & Navigation
    const uiStrings: { [key: string]: any } = {
        en: {
            listening: 'Listening...', thinking: 'Thinking...', speaking: 'Speaking...', tapToSpeak: 'Tap the Orb to Speak', tapToStop: 'Tap to Stop',
            home: 'Home', agriculture: 'Agriculture', skills: 'Skills', settings: 'Settings',
            marketHeader: 'Market Intelligence', skillsHeader: 'Agricultural Education',
            rates: 'Mandi Rates', vehicles: 'Agriculture Vehicles', schemes: 'Govt Schemes', marketing: 'Marketing & Success', advice: 'Cultivation Advice',
            ratesDesc: 'Check daily market prices for crops in your mandi.', vehiclesDesc: 'Tractors, harvesters, and transport vehicle prices.', schemesDesc: 'Central and State schemes for subsidies and loans.', marketingDesc: 'Success stories, bloggers, and selling strategies.', forecastingDesc: '7-day AI predictions for crop market prices.', forecasting: 'Forecasting',
            apply: 'Apply Now', watch: 'Watch Video', open: 'Open', back: 'Back',
            readSummary: 'Read Summary', moreDetails: 'More Details', showLess: 'Show Less',
            mandiPricePrediction: 'Mandi Price Prediction', weatherAgriWeather: 'Hyper-Local Agri-Weather',
            selectCrop: 'Select Crop', selectState: 'Select State', selectDistrict: 'Select District',
            allDistricts: 'All Districts', getForecast: 'Get Forecast',
            priceForecast: 'Price Forecast', aiPredictionFor: 'AI-powered 7-day price prediction for {state}',
            historicalHistory: 'Historical Data', aiPrediction: 'AI Prediction', todayStr: 'Today'
        },
        hi: {
            listening: 'सुन रहा हूँ...', thinking: 'सोच रहा हूँ...', speaking: 'बोल रहा हूँ...', tapToSpeak: 'बोलने के लिए टैप करें', tapToStop: 'रोकने के लिए टैप करें',
            home: 'होम', agriculture: 'कृषि', skills: 'कौशल', settings: 'सेटिंग्स',
            marketHeader: 'बाजार जानकारी', skillsHeader: 'कृषि शिक्षा',
            rates: 'मंडी भाव', vehicles: 'कृषि वाहन', schemes: 'सरकारी योजनाएं', marketing: 'विपणन और सफलता', advice: 'खेती की सलाह',
            ratesDesc: 'अपनी मंडी में फसलों के दैनिक बाजार भाव जांचें।', vehiclesDesc: 'ट्रैक्टर, हार्वेस्टर और परिवहन वाहनों की कीमतें।', schemesDesc: 'सब्सिडी और ऋण के लिए केंद्र और राज्य की योजनाएं।', marketingDesc: 'सफलता की कहानियाँ, ब्लॉगर्स और बिक्री रणनीतियाँ।', forecastingDesc: 'फसल बाजार की कीमतों के लिए 7-दिवसीय एआई भविष्यवाणियां।', forecasting: 'पूर्वानुमान',
            apply: 'आवेदन करें', watch: 'वीडियो देखें', open: 'खोलें', back: 'वापस जाएं',
            readSummary: 'सारांश सुनें', moreDetails: 'अधिक जानकारी', showLess: 'कम दिखाएं',
            mandiPricePrediction: 'मंडी भाव भविष्यवाणी', weatherAgriWeather: 'हाइपर-लोकल एग्री-वेदर',
            selectCrop: 'फसल चुनें', selectState: 'राज्य चुनें', selectDistrict: 'जिला चुनें',
            allDistricts: 'सभी जिले', getForecast: 'पूर्वानुमान प्राप्त करें',
            priceForecast: 'मूल्य पूर्वानुमान', aiPredictionFor: '{state} के लिए 7-दिवसीय AI मूल्य पूर्वानुमान',
            historicalHistory: 'ऐतिहासिक डेटा', aiPrediction: 'AI भविष्यवाणी', todayStr: 'आज'
        },
        bn: {
            listening: 'শুনছি...', speaking: 'বলছি...', tapToSpeak: 'বলার জন্য ট্যাপ করুন', tapToStop: 'থামাতে ট্যাপ করুন',
            home: 'হোম', agriculture: 'কৃষি', skills: 'দক্ষতা', settings: 'সেটিংস',
            marketHeader: 'বাজার তথ্য', skillsHeader: 'কৃষি শিক্ষা',
            rates: 'বাজার দর', vehicles: 'কৃষি যানবাহন', schemes: 'সরকারি প্রকল্প', marketing: 'বিপণন ও সাফল্য', advice: 'চাষের পরামর্শ',
            ratesDesc: 'আপনার মন্ডিতে ফসলের দৈনিক বাজার দর দেখুন।', vehiclesDesc: 'ট্র্যাক্টর, হারভেস্টার এবং পরিবহন যানের দাম।', schemesDesc: 'ভর্তুকি এবং ঋণের জন্য কেন্দ্র ও রাজ্যের প্রকল্প।', marketingDesc: 'সাফল্যের গল্প, ব্লগার এবং বিক্রয়ের কৌশল।', forecastingDesc: 'ফসলের বাজার দরের ৭ দিনের এআই পূর্বাভাস।', forecasting: 'পূর্বাভাস',
            apply: 'আবেদন করুন', watch: 'ভিডিও দেখুন', open: 'খুলুন', back: 'ফিরে যান',
            readSummary: 'সারাংশ শুনুন', moreDetails: 'আরও তথ্য', showLess: 'কম দেখান',
            mandiPricePrediction: 'মন্ডি মূল্য পূর্বাভাস', weatherAgriWeather: 'হাইপার-লোকাল এগ্রি-ওয়েদার',
            selectCrop: 'ফসল নির্বাচন', selectState: 'রাজ্য নির্বাচন', selectDistrict: 'জেলা নির্বাচন',
            allDistricts: 'সব জেলা', getForecast: 'পূর্বাভাস পান',
            priceForecast: 'মূল্য পূর্বাভাস', aiPredictionFor: '{state} এর জন্য ৭ দিনের AI মূল্য পূর্বাভাস',
            historicalHistory: 'ঐতিহাসিক তথ্য', aiPrediction: 'AI পূর্বাভাস', todayStr: 'আজ'

        },
        te: {
            listening: 'వింటున్నాను...', speaking: 'మాట్లాడుతున్నాను...', tapToSpeak: 'మాట్లాడటానికి నొక్కండి', tapToStop: 'ఆపడానికి నొక్కండి',
            home: 'హోమ్', agriculture: 'వ్యవసాయం', skills: 'నైపుణ్యాలు', settings: 'సెట్టింగ్లు',
            marketHeader: 'మార్కెట్ సమాచారం', skillsHeader: 'వ్యవసాయ విద్య',
            rates: 'మార్కెట్ రేట్లు', vehicles: 'వ్యవసాయ వాహనాలు', schemes: 'ప్రభుత్వ పథకాలు', marketing: 'మార్కెటింగ్ & విజయం', advice: 'సాగు సలహా',
            ratesDesc: 'మీ మార్కెట్‌లో పంటల రోజువారీ మార్కెట్ ధరలను తనిఖీ చేయండి.', vehiclesDesc: 'ట్రాక్టర్లు, హార్వెస్టర్లు మరియు రవాణా వాహనాల ధరలు.', schemesDesc: 'సబ్సిడీలు మరియు రుణాల కోసం కేంద్ర మరియు రాష్ట్ర ప్రభుత్వ పథకాలు.', marketingDesc: 'విజయ గాథలు, బ్లాగర్లు మరియు విక్రయ వ్యూహాలు.', forecastingDesc: 'పంట మార్కెట్ ధరల కోసం 7-రోజుల AI అంచనాలు.', forecasting: 'అంచనా',
            apply: 'దరఖాస్తు చేయండి', watch: 'వీడియో చూడండి', open: 'తెరవండి', back: 'వెనుకకు',
            readSummary: 'సారాంశం వినండి', moreDetails: 'మరిన్ని వివరాలు', showLess: 'తక్కువ చూపించు',
            mandiPricePrediction: 'మండీ ధరల అంచనా', weatherAgriWeather: 'హైపర్-లోకల్ అగ్రి-వెదర్',
            selectCrop: 'పంటను ఎంచుకోండి', selectState: 'రాష్ట్రాన్ని ఎంచుకోండి', selectDistrict: 'జిల్లాను ఎంచుకోండి',
            allDistricts: 'అన్ని జిల్లాలు', getForecast: 'అంచనా పొందండి',
            priceForecast: 'ధర అంచనా', aiPredictionFor: '{state} కోసం 7-రోజుల AI ధర అంచనా',
            historicalHistory: 'చారిత్రక డేటా', aiPrediction: 'AI అంచనా', todayStr: 'ఈరోజు'
        },
        mr: {
            listening: 'ऐकत आहे...', speaking: 'बोलत आहे...', tapToSpeak: 'बोलण्यासाठी टॅप करा', tapToStop: 'थांबवण्यासाठी टॅप करा',
            home: 'होम', agriculture: 'शेती', skills: 'कौशल्य', settings: 'सेटिंग्ज',
            marketHeader: 'बाजार माहिती', skillsHeader: 'कृषी शिक्षण',
            rates: 'बाजार भाव', vehicles: 'कृषी वाहने', schemes: 'सरकारी योजना', marketing: 'विपणन आणि यश', advice: 'शेती सल्ला',
            ratesDesc: 'तुमच्या मंडईतील पिकांचे दैनंदिन बाजार भाव तपासा.', vehiclesDesc: 'ट्रॅक्टर, हार्वेस्टर आणि वाहतूक वाहनांच्या किमती.', schemesDesc: 'अनुदान आणि कर्जासाठी केंद्र आणि राज्य सरकारांच्या योजना.', marketingDesc: 'यशोगाथा, ब्लॉगर्स आणि विक्री धोरणे.', forecastingDesc: 'पिकांच्या बाजारभावांसाठी ७ दिवसांचे एआय अंदाज.', forecasting: 'अंदाज',
            apply: 'अर्ज करा', watch: 'व्हिडिओ पहा', open: 'उघडा', back: 'मागे जा',
            readSummary: 'सारांश ऐका', moreDetails: 'अधिक माहिती', showLess: 'कमी दाखवा',
            mandiPricePrediction: 'मंडी भाव अंदाज', weatherAgriWeather: 'हायपर-लोकल अ‍ॅग्री-हवामान',
            selectCrop: 'पीक निवडा', selectState: 'राज्य निवडा', selectDistrict: 'जिल्हा निवडा',
            allDistricts: 'सर्व जिल्हे', getForecast: 'अंदाज मिळवा',
            priceForecast: 'किंमत अंदाज', aiPredictionFor: '{state} साठी 7-दिवसीय AI किंमत अंदाज',
            historicalHistory: 'ऐतिहासिक डेटा', aiPrediction: 'AI अंदाज', todayStr: 'आज'
        },
        ta: {
            listening: 'கேட்கிறேன்...', speaking: 'பேசுகிறேன்...', tapToSpeak: 'பேச தட்டவும்', tapToStop: 'நிறுத்த தட்டவும்',
            home: 'முகப்பு', agriculture: 'விவசாயம்', skills: 'திறன்கள்', settings: 'அமைப்புகள்',
            marketHeader: 'சந்தை நுண்ணறிவு', skillsHeader: 'விவசாய கல்வி',
            rates: 'சந்தை நிலவரம்', vehicles: 'விவசாய வாகனங்கள்', schemes: 'அரசு திட்டங்கள்', marketing: 'சந்தைப்படுத்தல்', advice: 'விவசாய ஆலோசனை',
            ratesDesc: 'உங்கள் சந்தையில் பயிர்களின் தினசரி விலை நிலவரங்களை சரிபார்க்கவும்.', vehiclesDesc: 'டிராக்டர்கள், அறுவடை இயந்திரங்கள் மற்றும் போக்குவரத்து வாகனங்களின் விலைகள்.', schemesDesc: 'மானியம் மற்றும் கடன்களுக்கான மத்திய, மாநில அரசின் திட்டங்கள்.', marketingDesc: 'வெற்றிக் கதைகள், பதிவர்கள் மற்றும் விற்பனை உத்திகள்.', forecastingDesc: 'பயிர் சந்தை விலைகளுக்கான 7 நாள் AI கணிப்புகள்.', forecasting: 'முன்கணிப்பு',
            apply: 'விண்ணப்பிக்க', watch: 'காணொளி பார்', open: 'திற', back: 'திரும்ப',
            readSummary: 'சுருக்கம் கேள்', moreDetails: 'மேலும் விவரங்கள்', showLess: 'குறைவாக காட்டு',
            mandiPricePrediction: 'மண்டி விலை முன்கணிப்பு', weatherAgriWeather: 'ஹைப்பர்-லோக்கல் அக்ரி-வானிலை',
            selectCrop: 'பயிரைத் தேர்ந்தெடுக்கவும்', selectState: 'மாநிலத்தைத் தேர்ந்தெடுக்கவும்', selectDistrict: 'மாவட்டத்தைத் தேர்ந்தெடுக்கவும்',
            allDistricts: 'அனைத்து மாவட்டங்களும்', getForecast: 'முன்கணிப்பைப் பெறுங்கள்',
            priceForecast: 'விலை முன்கணிப்பு', aiPredictionFor: '{state} க்கான 7-நாள் AI விலை முன்கணிப்பு',
            historicalHistory: 'வரலாற்று தரவு', aiPrediction: 'AI முன்கணிப்பு', todayStr: 'இன்று'
        },
        gu: {
            listening: 'સાંભળી રહ્યો છું...', speaking: 'બોલી રહ્યો છું...', tapToSpeak: 'બોલવા માટે ટેપ કરો', tapToStop: 'અટકાવવા માટે ટેપ કરો',
            home: 'હોમ', agriculture: 'કૃષિ', skills: 'કૌશલ્ય', settings: 'સેટિંગ્સ',
            marketHeader: 'બજાર માહિતી', skillsHeader: 'કૃષિ શિક્ષણ',
            rates: 'બજાર ભાવ', vehicles: 'કૃષિ વાહનો', schemes: 'સરકારી યોજનાઓ', marketing: 'માર્કેટિંગ અને સફળતા', advice: 'ખેતી સલાહ',
            ratesDesc: 'તમારી મંડીમાં પાકના દૈનિક બજાર ભાવ તપાસો.', vehiclesDesc: 'ટ્રેક્ટર, હાર્વેસ્ટર અને પરિવહન વાહનોના ભાવ.', schemesDesc: 'સબસિડી અને લોન માટે કેન્દ્ર અને રાજ્યની યોજનાઓ.', marketingDesc: 'સફળતાની વાર્તાઓ, બ્લોગરો અને વેચાણ વ્યૂહરચનાઓ.', forecastingDesc: 'પાકના બજાર ભાવ માટે 7-દિવસની AI આગાહીઓ.', forecasting: 'આગાહી',
            apply: 'અરજી કરો', watch: 'વિડિઓ જુઓ', open: 'ખોલો', back: 'પાછા',
            readSummary: 'સારાંશ સાંભળો', moreDetails: 'વધુ વિગત', showLess: 'ઓછું બતાવો',
            mandiPricePrediction: 'મંડી ભાવની આગાહી', weatherAgriWeather: 'હાઇપર-લોકલ એગ્રી-વેધર',
            selectCrop: 'પાક પસંદ કરો', selectState: 'રાજ્ય પસંદ કરો', selectDistrict: 'જિલ્લો પસંદ કરો',
            allDistricts: 'બધા જિલ્લાઓ', getForecast: 'આગાહી મેળવો',
            priceForecast: 'કિંમત આગાહી', aiPredictionFor: '{state} માટે 7-દિવસની AI કિંમત આગાહી',
            historicalHistory: 'ઐતિહાસિક ડેટા', aiPrediction: 'AI આગાહી', todayStr: 'આજે'
        },
        kn: {
            listening: 'ಕೇಳಿಸಿಕೊಳ್ಳುತ್ತಿದ್ದೇನೆ...', speaking: 'ಮಾತನಾಡುತ್ತಿದ್ದೇನೆ...', tapToSpeak: 'ಮಾತನಾಡಲು ಟ್ಯಾಪ್ ಮಾಡಿ', tapToStop: 'ನಿಲ್ಲಿಸಲು ಟ್ಯಾಪ್ ಮಾಡಿ',
            home: 'ಹೋಮ್', agriculture: 'ಕೃಷಿ', skills: 'ಕೌಶಲ್ಯ', settings: 'ಸೆಟ್ಟಿಂಗ್ಸ್',
            marketHeader: 'ಮಾರುಕಟ್ಟೆ ಮಾಹಿತಿ', skillsHeader: 'ಕೃಷಿ ಶಿಕ್ಷಣ',
            rates: 'ಮಾರುಕಟ್ಟೆ ದರ', vehicles: 'ಕೃಷಿ ವಾಹನಗಳು', schemes: 'ಸರ್ಕಾರಿ ಯೋಜನೆ', marketing: 'ಮಾರ್ಕೆಟಿಂಗ್ ಮತ್ತು ಯಶಸ್ಸು', advice: 'ಕೃಷಿ ಸಲಹೆ',
            ratesDesc: 'ನಿಮ್ಮ ಮಾರುಕಟ್ಟೆಯಲ್ಲಿ ಬೆಳೆಗಳ ದೈನಂದಿನ ಮಾರುಕಟ್ಟೆ ಬೆಲೆಗಳನ್ನು ಪರಿಶೀಲಿಸಿ.', vehiclesDesc: 'ಟ್ರ್ಯಾಕ್ಟರ್‌ಗಳು, ಹಾರ್ವೆಸ್ಟರ್‌ಗಳು ಮತ್ತು ಸಾರಿಗೆ ವಾಹನಗಳ ಬೆಲೆಗಳು.', schemesDesc: 'ಸಬ್ಸಿಡಿ ಮತ್ತು ಸಾಲಗಳಿಗಾಗಿ ಕೇಂದ್ರ ಮತ್ತು ರಾಜ್ಯದ ಯೋಜನೆಗಳು.', marketingDesc: 'ಯಶಸ್ಸಿನ ಕಥೆಗಳು, ಬ್ಲಾಗರ್‌ಗಳು ಮತ್ತು ಮಾರಾಟ ತಂತ್ರಗಳು.', forecastingDesc: 'ಬೆಳೆ ಮಾರುಕಟ್ಟೆ ಬೆಲೆಗಳಿಗೆ 7-ದಿನದ ಎಐ ಮುನ್ಸೂಚನೆಗಳು.', forecasting: 'ಮುನ್ಸೂಚನೆ',
            apply: 'ಅರ್ಜಿ ಹಾಕಿ', watch: 'ವೀಡಿಯೊ ನೋಡಿ', open: 'ತೆರೆಯಿರಿ', back: 'ಹಿಂದೆ',
            readSummary: 'ಸಾರಾಂಶ ಕೇಳಿ', moreDetails: 'ಹೆಚ್ಚಿನ ಮಾಹಿತಿ', showLess: 'ಕಡಿಮೆ ತೋರಿಸಿ',
            mandiPricePrediction: 'ಮಾರುಕಟ್ಟೆ ಬೆಲೆ ಮುನ್ಸೂಚನೆ', weatherAgriWeather: 'ಹೈಪರ್-ಲೋಕಲ್ ಅಗ್ರಿ-ವೆದರ್',
            selectCrop: 'ಬೆಳೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ', selectState: 'ರಾಜ್ಯವನ್ನು ಆಯ್ಕೆಮಾಡಿ', selectDistrict: 'ಜಿಲ್ಲೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ',
            allDistricts: 'ಎಲ್ಲಾ ಜಿಲ್ಲೆಗಳು', getForecast: 'ಮುನ್ಸೂಚನೆ ಪಡೆಯಿರಿ',
            priceForecast: 'ಬೆಲೆ ಮುನ್ಸೂಚನೆ', aiPredictionFor: '{state} ಗಾಗಿ 7-ದಿನದ AI ಬೆಲೆ ಮುನ್ಸೂಚನೆ',
            historicalHistory: 'ಐತಿಹಾಸಿಕ ಡೇಟಾ', aiPrediction: 'AI ಮುನ್ಸೂಚನೆ', todayStr: 'ಇಂದು'
        },
        ml: {
            listening: 'കേൾക്കുന്നു...', speaking: 'സംസാരിക്കുന്നു...', tapToSpeak: 'സംസാരിക്കാൻ ടാപ്പ് ചെയ്യുക', tapToStop: 'നിർത്താൻ ടാಪ್ ചെയ്യുക',
            home: 'ഹോം', agriculture: 'കൃഷി', skills: 'നൈപുണ്യം', settings: 'ക്രമീകരണങ്ങൾ',
            marketHeader: 'വിപണി വിവരങ്ങൾ', skillsHeader: 'കാർഷിക വിദ്യാഭ്യാസം',
            rates: 'വിപണി നിരക്കുകൾ', vehicles: 'കാർഷിക വാഹനങ്ങൾ', schemes: 'സർക്കാർ പദ്ധതികൾ', marketing: 'മാർക്കറ്റിംഗ് & വിജയം', advice: 'കൃഷി ഉപദേശം',
            ratesDesc: 'നിങ്ങളുടെ വിപണിയിലെ വിളകളുടെ പ്രതിദിന വിലകൾ പരിശോധിക്കുക.', vehiclesDesc: 'ട്രാക്ടറുകൾ, കൊയ്ത്തുയന്ത്രങ്ങൾ, ഗതാഗത വാഹനങ്ങൾ എന്നിവയുടെ വിലകൾ.', schemesDesc: 'സബ്സിഡികൾക്കും വായ്പകൾക്കുമുള്ള കേന്ദ്ര-സംസ്ഥാന പദ്ധതികൾ.', marketingDesc: 'വിജയഗാഥകൾ, ബ്ലോഗർമാർ, വിൽപ്പന തന്ത്രങ്ങൾ.', forecastingDesc: 'വിള വിപണി വിലകൾക്കുള്ള 7 ദിവസത്തെ AI പ്രവചനങ്ങൾ.', forecasting: 'പ്രവചനം',
            apply: 'അപേക്ഷിക്കുക', watch: 'വീഡിയോ കാണുക', open: 'തുറക്കുക', back: 'തിരികെ',
            readSummary: 'സംഗ്രഹം കേൾക്കുക', moreDetails: 'കൂടുതൽ വിവരങ്ങൾ', showLess: 'കുറച്ചു കാണിക്കുക',
            mandiPricePrediction: 'മണ്ടി വില പ്രവചനം', weatherAgriWeather: 'ഹൈപ്പർ-ലോക്കൽ അഗ്രി-കാലാവസ്ഥ',
            selectCrop: 'വിള തിരഞ്ഞെടുക്കുക', selectState: 'സംസ്ഥാനം തിരഞ്ഞെടുക്കുക', selectDistrict: 'ജില്ല തിരഞ്ഞെടുക്കുക',
            allDistricts: 'എല്ലാ ജില്ലകളും', getForecast: 'പ്രവചനം നേടുക',
            priceForecast: 'വില പ്രവചനം', aiPredictionFor: '{state} -നുള്ള 7 ദിവസത്തെ AI വില പ്രവചനം',
            historicalHistory: 'ചരിത്രപരമായ വിവരങ്ങൾ', aiPrediction: 'AI പ്രവചനം', todayStr: 'ഇന്ന്'
        },
    };

    const currentUI = uiStrings[language] || uiStrings['en'];



    const stopSpeaking = () => {
        // Stop browser TTS
        window.speechSynthesis.cancel();

        // Stop custom audio if playing
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current = null;
        }

        setVoiceStatus('idle');
        return true;
    };

    const handleMicClick = () => {
        // If AI is speaking/thinking, STOP it immediately.
        if (voiceStatus === 'speaking' || voiceStatus === 'thinking' || window.speechSynthesis.speaking) {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
            stopSpeaking();
            return;
        }

        if (voiceStatus === 'listening') {
            stopRecording();
            return;
        }

        startRecording();
    };

    const startRecording = async () => {
        // Double check lock
        if (voiceStatus !== 'idle') return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                handleChat(null, audioBlob);
            };

            mediaRecorder.start();
            setVoiceStatus('listening');

            console.log("Recording started...");
        } catch (err) {
            console.error("Mic access denied:", err);
            alert("Microphone access is required for voice communication.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            console.log("Recording stopped.");
        }
    };

    const playAudioResponse = (url: string) => {
        console.log(`[AUDIO] Playing: ${url}`);

        // Stop any existing audio
        stopSpeaking();

        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onplay = () => {
            console.log("[AUDIO] Playback started");
            setVoiceStatus('speaking'); // Visual "Speaking" state
        };
        audio.onended = () => {
            console.log("[AUDIO] Playback ended");
            setVoiceStatus('idle'); // Reset to idle when done
            audioRef.current = null;
        };
        audio.onerror = (e) => {
            console.error("[AUDIO] Playback error:", e);
            setVoiceStatus('idle');
            audioRef.current = null;
        };

        // Play
        audio.play().catch(err => {
            console.error("[AUDIO] Play failed:", err);
            setVoiceStatus('idle');
            audioRef.current = null;
        });
    };

    const fetchAndPlayTTS = async (text: string) => {
        setVoiceStatus('thinking');

        if (!abortControllerRef.current) {
            abortControllerRef.current = new AbortController();
        }
        const signal = abortControllerRef.current.signal;

        try {
            const ttsResponse = await fetch('/api/chat/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                body: JSON.stringify({
                    text: text,
                    language: language
                }),
                signal: signal
            });

            if (ttsResponse.ok) {
                const ttsData = await ttsResponse.json();
                if (ttsData.audio_url) {
                    playAudioResponse(ttsData.audio_url);
                } else {
                    setVoiceStatus('idle');
                }
            } else {
                setVoiceStatus('idle');
            }
        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('TTS fetch aborted by user');
                return;
            }
            console.error("TTS fetch error:", error);
            setVoiceStatus('idle');
        }
    };

    const deleteMessage = async (id: string) => {
        try {
            const res = await fetch(`/api/chat/history/${id}`, {
                method: 'DELETE',
                headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
            });

            if (res.status === 401) {
                handleLogout();
                return;
            }

            setMessages(prev => prev.filter(m => m.id !== id));
        } catch (err) {
            console.error("Failed to delete message", err);
        }
    };

    const clearHistory = async () => {
        try {
            const res = await fetch(`/api/chat/history`, {
                method: 'DELETE',
                headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
            });

            if (res.status === 401) {
                handleLogout();
                return;
            }

            setMessages([]);
        } catch (err) {
            console.error("Failed to clear history", err);
        }
    };

    const handleChat = async (text: string | null, audioBlob: Blob | null = null) => {
        setVoiceStatus('thinking');

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        try {
            const formData = new FormData();
            if (audioBlob) {
                // Prevent overlapping requests if already speaking/thinking
                if (voiceStatus === 'speaking' || voiceStatus === 'thinking' || window.speechSynthesis.speaking) {
                    console.log("Ignored input while speaking");
                    return;
                }
                formData.append('audio', audioBlob, 'input.webm');
            } else if (text) {
                formData.append('message', text);
            }

            formData.append('language', language);
            // Optimization: Don't request audio yet. Get text first.
            formData.append('voice_enabled', 'false');

            const headers: HeadersInit = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: token ? { 'Authorization': `Bearer ${token}` } : undefined,
                body: formData,
                signal: signal
            });

            if (response.status === 401) {
                handleLogout();
                return;
            }

            if (!response.ok) throw new Error("Server error");

            const data = await response.json();

            // Add messages to history IMMEDIATELY
            const userMsg: Message = {
                id: Date.now().toString(),
                text: data.user_text || text || "Voice Input",
                sender: 'user',
                timestamp: new Date()
            };

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                text: data.response_text,
                sender: 'ai',
                timestamp: new Date()
            };

            setMessages(prev => [...prev, userMsg, aiMsg]);

            if (data.detected_language && data.detected_language !== language) {
                setLanguage(data.detected_language);
            }

            // Now, fetch audio separately using the helper
            if (audioBlob || text) {
                // Split response to get summary for TTS
                const summary = data.response_text.split('|||')[0].trim();
                await fetchAndPlayTTS(summary);
            } else {
                setVoiceStatus('idle');
            }

        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('Chat fetch aborted by user');
                return;
            }
            console.error("Chat Error:", error);
            setVoiceStatus('idle');
            setConnectionError(true);
            setTimeout(() => setConnectionError(false), 5000);
        }
    };

    if (!token) {
        return (
            <div className="flex h-screen w-full bg-background items-center justify-center relative overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />
                <Auth onLogin={handleLogin} />
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-50 font-sans overflow-hidden antialiased">
            <Sidebar
                activeTab={activeTab}
                setActiveTab={(tab: any) => setActiveTab(tab)}
                labels={{
                    home: currentUI.home,
                    agriculture: currentUI.agriculture,
                    skills: currentUI.skills,
                    settings: currentUI.settings
                }}
                username={username}
                displayName={displayName}
                avatarUrl={avatarUrl}
            />

            <main className="flex-1 flex flex-col relative">
                <header className="absolute top-6 w-full px-8 flex justify-between items-center z-10">
                    <div className="text-xl font-semibold text-white/50 pointer-events-none">EventHorizon <span className="text-gray-500 font-normal">AI</span></div>
                    <LanguageSelector currentLanguage={language} onLanguageChange={setLanguage} />
                </header>

                {connectionError && (
                    <div className="absolute top-24 z-50 bg-red-500/90 text-white px-6 py-3 rounded-lg flex items-center gap-3 backdrop-blur-sm animate-bounce-in">
                        <AlertCircle className="w-5 h-5" />
                        <span>Could not connect to server. Please ensure backend is running.</span>
                    </div>
                )}

                {activeTab === 'home' ? (
                    <div className="flex flex-col h-full w-full relative text-base md:text-lg">
                        {/* Chat Area - Full Height */}
                        <div className="flex-1 overflow-y-auto px-4 pb-24 custom-scrollbar scroll-smooth">
                            {messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center opacity-60">
                                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6">
                                        <AlertCircle className="w-8 h-8 text-purple-400 rotate-180" />
                                    </div>
                                    <h2 className="text-2xl font-bold mb-2">EventHorizon AI</h2>
                                    <p className="text-gray-400 max-w-md mx-auto">
                                        Your intelligent assistant for agriculture and skills. Tap the mic or type to start.
                                    </p>

                                    {voiceStatus === 'listening' && <p className="mt-8 text-xl text-blue-400 animate-pulse font-medium">{currentUI.listening}</p>}
                                    {voiceStatus === 'thinking' && <p className="mt-8 text-xl text-purple-400 animate-pulse font-medium">{currentUI.thinking}</p>}
                                    {voiceStatus === 'speaking' && <p className="mt-8 text-xl text-blue-400 font-medium">{currentUI.speaking}</p>}
                                </div>
                            ) : (
                                <div className="pt-20 space-y-6">
                                    <ChatBox messages={messages} onReadAloud={fetchAndPlayTTS} />
                                    {/* Status Indicators in Chat Flow */}
                                    {voiceStatus === 'thinking' && (
                                        <div className="flex gap-4 animate-fade-in pl-4">
                                            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
                                                <div className="w-2 h-2 bg-purple-400 rounded-full animate-ping" />
                                            </div>
                                            <div className="bg-white/5 rounded-2xl rounded-tl-none p-4 border border-white/10 flex items-center gap-3">
                                                <span className="text-gray-300 text-sm">{currentUI.thinking}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            <div id="scroll-anchor" className="h-4" />
                        </div>

                        {/* New Futuristic Interactive AI Input Component */}
                        <InteractiveAIInput
                            voiceStatus={voiceStatus}
                            onMicClick={handleMicClick}
                            onSubmitText={(text) => handleChat(text)}
                        />
                    </div>
                ) : activeTab === 'agriculture' ? (
                    <MarketDashboard
                        onBack={() => setActiveTab('home')}
                        currentLanguage={language}
                        labels={currentUI}
                        onMoreDetails={(query) => {
                            setActiveTab('home');
                            // Small timeout to allow tab switch before triggering chat
                            setTimeout(() => {
                                handleChat(`Tell me more details about ${query} market rates, including potential future trends and advice.`);
                            }, 100);
                        }}
                    />
                ) : activeTab === 'skills' ? (
                    <SkillsDashboard
                        onBack={() => setActiveTab('home')}
                        courses={courses}
                        headerText={currentUI.skillsHeader}
                        labels={currentUI}
                    />
                ) : (
                    <Settings
                        onBack={() => setActiveTab('home')}
                        messages={messages}
                        onDeleteMessage={deleteMessage}
                        onClearHistory={clearHistory}
                        currentLanguage={language}
                        onLanguageChange={setLanguage}
                        username={username}
                        displayName={displayName}
                        avatarUrl={avatarUrl}
                        token={token}
                        onUpdateProfile={async (updates: ProfileUpdate) => {
                            if (updates.displayName !== undefined) {
                                setDisplayName(updates.displayName);
                                localStorage.setItem('display_name', updates.displayName);
                            }
                            if (updates.avatarUrl !== undefined) {
                                setAvatarUrl(updates.avatarUrl);
                                try {
                                    localStorage.setItem('avatar_url', updates.avatarUrl);
                                } catch (e) {
                                    console.warn('Could not save avatar to localStorage (quota exceeded)');
                                }
                            }
                        }}
                        onLogout={handleLogout}
                    />
                )}

                {activeTab === 'home' && (
                    <div className="absolute inset-0 z-0 flex items-center justify-between px-20 pointer-events-none">
                        {/* InfoCards removed as per user request */}
                    </div>
                )}

                {/* MarketTicker removed as per user request */}

                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />
            </main>
        </div>
    );
}

export default App;
