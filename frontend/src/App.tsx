import { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import VoiceOrb from './components/VoiceOrb';
import LanguageSelector from './components/LanguageSelector';

import MarketDashboard from './components/MarketDashboard';
import SkillsDashboard from './components/SkillsDashboard';
import Settings from './components/Settings';
import Auth from './components/Auth';
import { MicOff, AlertCircle, TrendingUp, Loader2, StopCircle } from 'lucide-react';
import ChatBox from './components/ChatBox';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'ai';
    timestamp: Date;
}

function App() {
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [username, setUsername] = useState<string | null>(localStorage.getItem('username'));

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

    // Check auth on mount
    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('username');
        if (storedToken) {
            setToken(storedToken);
            setUsername(storedUser);
        }
    }, []);

    useEffect(() => {
        if (!token) return;

        const fetchData = async () => {
            try {
                const headers = { 'Authorization': `Bearer ${token}` };
                const [coursesRes, historyRes] = await Promise.all([
                    fetch(`/api/market/courses?language=${language}`),
                    fetch('/api/chat/history', { headers })
                ]);

                const coursesJson = await coursesRes.json();
                const historyJson = await historyRes.json();

                setCourses(coursesJson);

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
        setToken(null);
        setUsername(null);
        setMessages([]);
    };

    // Localization for UI status messages & Navigation
    const uiStrings: { [key: string]: any } = {
        en: {
            listening: 'Listening...', thinking: 'Thinking...', speaking: 'Speaking...', tapToSpeak: 'Tap the Orb to Speak', tapToStop: 'Tap to Stop',
            home: 'Home', agriculture: 'Agriculture', skills: 'Skills', settings: 'Settings',
            marketHeader: 'Market Intelligence', skillsHeader: 'Agricultural Education',
            rates: 'Real-time Rates', vehicles: 'Agriculture Vehicles', schemes: 'Govt Schemes', marketing: 'Marketing & Success', advice: 'Cultivation Advice',
            apply: 'Apply Now', watch: 'Watch Video', open: 'Open', back: 'Back',
            readSummary: 'Read Summary', moreDetails: 'More Details', showLess: 'Show Less'
        },
        hi: {
            listening: 'सुन रहा हूँ...', thinking: 'सोच रहा हूँ...', speaking: 'बोल रहा हूँ...', tapToSpeak: 'बोलने के लिए टैप करें', tapToStop: 'रोकने के लिए टैप करें',
            home: 'होम', agriculture: 'कृषि', skills: 'कौशल', settings: 'सेटिंग्स',
            marketHeader: 'बाजार जानकारी', skillsHeader: 'कृषि शिक्षा',
            rates: 'मंडी भाव', vehicles: 'कृषि वाहन', schemes: 'सरकारी योजनाएं', marketing: 'विपणन और सफलता', advice: 'खेती की सलाह',
            apply: 'आवेदन करें', watch: 'वीडियो देखें', open: 'खोलें', back: 'वापस जाएं',
            readSummary: 'सारांश सुनें', moreDetails: 'अधिक जानकारी', showLess: 'कम दिखाएं'
        },
        bn: {
            listening: 'শুনছি...', speaking: 'বলছি...', tapToSpeak: 'বলার জন্য ট্যাপ করুন', tapToStop: 'থামাতে ট্যাপ করুন',
            home: 'হোম', agriculture: 'কৃষি', skills: 'দক্ষতা', settings: 'সেটিংস',
            marketHeader: 'বাজার তথ্য', skillsHeader: 'কৃষি শিক্ষা',
            rates: 'বাজার দর', vehicles: 'কৃষি যানবাহন', schemes: 'সরকারি প্রকল্প', marketing: 'বিপণন ও সাফল্য', advice: 'চাষের পরামর্শ',
            apply: 'আবেদন করুন', watch: 'ভিডিও দেখুন', open: 'খুলুন', back: 'ফিরে যান',
            readSummary: 'সারাংশ শুনুন', moreDetails: 'আরও তথ্য', showLess: 'কম দেখান'

        },
        te: {
            listening: 'వింటున్నాను...', speaking: 'మాట్లాడుతున్నాను...', tapToSpeak: 'మాట్లాడటానికి నొక్కండి', tapToStop: 'ఆపడానికి నొక్కండి',
            home: 'హోమ్', agriculture: 'వ్యవసాయం', skills: 'నైపుణ్యాలు', settings: 'సెట్టింగ్లు',
            marketHeader: 'మార్కెట్ సమాచారం', skillsHeader: 'వ్యవసాయ విద్య',
            rates: 'మార్కెట్ రేట్లు', vehicles: 'వ్యవసాయ వాహనాలు', schemes: 'ప్రభుత్వ పథకాలు', marketing: 'మార్కెటింగ్ & విజయం', advice: 'సాగు సలహా',
            apply: 'దరఖాస్తు చేయండి', watch: 'వీడియో చూడండి', open: 'తెరవండి', back: 'వెనుకకు',
            readSummary: 'సారాంశం వినండి', moreDetails: 'మరిన్ని వివరాలు', showLess: 'తక్కువ చూపించు'
        },
        mr: {
            listening: 'ऐकत आहे...', speaking: 'बोलत आहे...', tapToSpeak: 'बोलण्यासाठी टॅप करा', tapToStop: 'थांबवण्यासाठी टॅप करा',
            home: 'होम', agriculture: 'शेती', skills: 'कौशल्य', settings: 'सेटिंग्ज',
            marketHeader: 'बाजार माहिती', skillsHeader: 'कृषी शिक्षण',
            rates: 'बाजार भाव', vehicles: 'कृषी वाहने', schemes: 'सरकारी योजना', marketing: 'विपणन आणि यश', advice: 'शेती सल्ला',
            apply: 'अर्ज करा', watch: 'व्हिडिओ पहा', open: 'उघडा', back: 'मागे जा',
            readSummary: 'सारांश ऐका', moreDetails: 'अधिक माहिती', showLess: 'कमी दाखवा'
        },
        ta: {
            listening: 'கேட்கிறேன்...', speaking: 'பேசுகிறேன்...', tapToSpeak: 'பேச தட்டவும்', tapToStop: 'நிறுத்த தட்டவும்',
            home: 'முகப்பு', agriculture: 'விவசாயம்', skills: 'திறன்கள்', settings: 'அமைப்புகள்',
            marketHeader: 'சந்தை நுண்ணறிவு', skillsHeader: 'விவசாய கல்வி',
            rates: 'சந்தை நிலவரம்', vehicles: 'விவசாய வாகனங்கள்', schemes: 'அரசு திட்டங்கள்', marketing: 'சந்தைப்படுத்தல்', advice: 'விவசாய ஆலோசனை',
            apply: 'விண்ணப்பிக்க', watch: 'காணொளி பார்', open: 'திற', back: 'திரும்ப',
            readSummary: 'சுருக்கம் கேள்', moreDetails: 'மேலும் விவரங்கள்', showLess: 'குறைவாக காட்டு'
        },
        gu: {
            listening: 'સાંભળી રહ્યો છું...', speaking: 'બોલી રહ્યો છું...', tapToSpeak: 'બોલવા માટે ટેપ કરો', tapToStop: 'અટકાવવા માટે ટેપ કરો',
            home: 'હોમ', agriculture: 'કૃષિ', skills: 'કૌશલ્ય', settings: 'સેટિંગ્સ',
            marketHeader: 'બજાર માહિતી', skillsHeader: 'કૃષિ શિક્ષણ',
            rates: 'બજાર ભાવ', vehicles: 'કૃષિ વાહનો', schemes: 'સરકારી યોજનાઓ', marketing: 'માર્કેટિંગ અને સફળતા', advice: 'ખેતી સલાહ',
            apply: 'અરજી કરો', watch: 'વિડિઓ જુઓ', open: 'ખોલો', back: 'પાછા',
            readSummary: 'સારાંશ સાંભળો', moreDetails: 'વધુ વિગત', showLess: 'ઓછું બતાવો'
        },
        kn: {
            listening: 'ಕೇಳಿಸಿಕೊಳ್ಳುತ್ತಿದ್ದೇನೆ...', speaking: 'ಮಾತನಾಡುತ್ತಿದ್ದೇನೆ...', tapToSpeak: 'ಮಾತನಾಡಲು ಟ್ಯಾಪ್ ಮಾಡಿ', tapToStop: 'ನಿಲ್ಲಿಸಲು ಟ್ಯಾಪ್ ಮಾಡಿ',
            home: 'ಹೋಮ್', agriculture: 'ಕೃಷಿ', skills: 'ಕೌಶಲ್ಯ', settings: 'ಸೆಟ್ಟಿಂಗ್ಸ್',
            marketHeader: 'ಮಾರುಕಟ್ಟೆ ಮಾಹಿತಿ', skillsHeader: 'ಕೃಷಿ ಶಿಕ್ಷಣ',
            rates: 'ಮಾರುಕಟ್ಟೆ ದರ', vehicles: 'ಕೃಷಿ ವಾಹನಗಳು', schemes: 'ಸರ್ಕಾರಿ ಯೋಜನೆ', marketing: 'ಮಾರ್ಕೆಟಿಂಗ್ ಮತ್ತು ಯಶಸ್ಸು', advice: 'ಕೃಷಿ ಸಲಹೆ',
            apply: 'ಅರ್ಜಿ ಹಾಕಿ', watch: 'ವೀಡಿಯೊ ನೋಡಿ', open: 'ತೆರೆಯಿರಿ', back: 'ಹಿಂದೆ',
            readSummary: 'ಸಾರಾಂಶ ಕೇಳಿ', moreDetails: 'ಹೆಚ್ಚಿನ ಮಾಹಿತಿ', showLess: 'ಕಡಿಮೆ ತೋರಿಸಿ'
        },
        ml: {
            listening: 'കേൾക്കുന്നു...', speaking: 'സംസാരിക്കുന്നു...', tapToSpeak: 'സംസാരിക്കാൻ ടാപ്പ് ചെയ്യുക', tapToStop: 'നിർത്താൻ ടാಪ್ ചെയ്യുക',
            home: 'ഹോം', agriculture: 'കൃഷി', skills: 'നൈപുണ്യം', settings: 'ക്രമീകരണങ്ങൾ',
            marketHeader: 'വിപണി വിവരങ്ങൾ', skillsHeader: 'കാർഷിക വിദ്യാഭ്യാസം',
            rates: 'വിപണി നിരക്കുകൾ', vehicles: 'കാർഷിക വാഹനങ്ങൾ', schemes: 'സർക്കാർ പദ്ധതികൾ', marketing: 'മാർക്കറ്റിംഗ് & വിജയം', advice: 'കൃഷി ഉപദേശം',
            apply: 'അപേക്ഷിക്കുക', watch: 'വീഡിയോ കാണുക', open: 'തുറക്കുക', back: 'തിരികെ',
            readSummary: 'സംഗ്രഹം കേൾക്കുക', moreDetails: 'കൂടുതൽ വിവരങ്ങൾ', showLess: 'കുറച്ചു കാണിക്കുക'
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
        try {
            const ttsResponse = await fetch('/api/chat/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                body: JSON.stringify({
                    text: text,
                    language: language
                })
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
        } catch (error) {
            console.error("TTS fetch error:", error);
            setVoiceStatus('idle');
        }
    };

    const deleteMessage = async (id: string) => {
        try {
            await fetch(`/api/chat/history/${id}`, {
                method: 'DELETE',
                headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
            });
            setMessages(prev => prev.filter(m => m.id !== id));
        } catch (err) {
            console.error("Failed to delete message", err);
        }
    };

    const clearHistory = async () => {
        try {
            await fetch(`/api/chat/history`, {
                method: 'DELETE',
                headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
            });
            setMessages([]);
        } catch (err) {
            console.error("Failed to clear history", err);
        }
    };

    const handleChat = async (text: string | null, audioBlob: Blob | null = null) => {
        setVoiceStatus('thinking');
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

            const response = await fetch('/api/chat/', {
                method: 'POST',
                headers: token ? { 'Authorization': `Bearer ${token}` } : undefined,
                body: formData,
            });

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

        } catch (error) {
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
        <div className="flex h-screen w-full bg-background text-white font-sans overflow-hidden">
            <Sidebar
                activeTab={activeTab}
                setActiveTab={(tab: any) => setActiveTab(tab)}
                labels={{
                    home: currentUI.home,
                    agriculture: currentUI.agriculture,
                    skills: currentUI.skills,
                    settings: currentUI.settings
                }}
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

                        {/* Input Area (Fixed Bottom) */}
                        <div className="absolute bottom-6 left-4 right-4 z-20">
                            <div className="w-full max-w-4xl mx-auto bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl p-2 flex items-end gap-2 shadow-2xl ring-1 ring-white/5 transition-all duration-300">
                                <button className="p-3 rounded-full bg-white/5 text-gray-400 hover:text-white transition-colors mb-1">
                                    <TrendingUp className="w-5 h-5" />
                                </button>

                                <textarea
                                    placeholder={voiceStatus === 'listening' ? "Listening..." : "Message EventHorizon..."}
                                    className="flex-1 bg-transparent border-none focus:outline-none text-white px-2 py-3 placeholder-gray-500 text-base resize-none overflow-hidden min-h-[48px] max-h-48"
                                    rows={1}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            if (e.currentTarget.value.trim()) {
                                                handleChat(e.currentTarget.value);
                                                e.currentTarget.value = '';
                                                e.currentTarget.style.height = 'auto';
                                            }
                                        }
                                    }}
                                    onInput={(e) => {
                                        const target = e.currentTarget;
                                        target.style.height = 'auto';
                                        target.style.height = `${target.scrollHeight}px`;
                                    }}
                                    disabled={voiceStatus === 'listening'}
                                />

                                {/* Mic Button inside Input Box - Blue=Speak, Purple=Think, Red=Listen */}
                                <button
                                    onClick={handleMicClick}
                                    className={`p-1.5 rounded-full transition-all duration-300 relative group overflow-hidden mb-1.5 mr-1 ${voiceStatus === 'listening' ? 'bg-red-500 text-white' :
                                        voiceStatus === 'thinking' ? 'bg-purple-600 text-white animate-pulse' :
                                            voiceStatus === 'speaking' ? 'bg-blue-600 text-white' :
                                                'bg-white/10 text-white hover:bg-white/20'
                                        }`}
                                // Removed disabled attribute so user can click to STOP
                                >
                                    {voiceStatus === 'idle' && <VoiceOrb status="idle" size="sm" />}
                                    {voiceStatus === 'listening' && <MicOff className="w-4 h-4 animate-pulse" />}
                                    {voiceStatus === 'thinking' && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {voiceStatus === 'speaking' && <StopCircle className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
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
                        onUpdateProfile={(name) => {
                            setUsername(name);
                            localStorage.setItem('username', name);
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
