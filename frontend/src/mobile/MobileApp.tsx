import { useState, useEffect, useRef } from 'react';
import MobileSidebar from './components/MobileSidebar';
import LanguageSelector from '../components/LanguageSelector';
import MobileMarketDashboard from './components/MobileMarketDashboard';
import MobileSkillsDashboard from './components/MobileSkillsDashboard';
import MobileSettings from './components/MobileSettings';
import MobileVisualScanner from './components/MobileVisualScanner';
import Auth from '../components/Auth';
import { AlertCircle } from 'lucide-react';
import ChatBox from '../components/ChatBox';
import MobileInteractiveAIInput from './components/MobileInteractiveAIInput';
import { useAudioPipeline } from '../hooks/useAudioPipeline';

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

function MobileApp() {
    const [token, setToken] = useState<string | null>(sessionStorage.getItem('token'));
    const [username, setUsername] = useState<string | null>(sessionStorage.getItem('username'));
    const [displayName, setDisplayName] = useState<string | null>(sessionStorage.getItem('display_name'));
    const [avatarUrl, setAvatarUrl] = useState<string | null>(sessionStorage.getItem('avatar_url'));

    const [voiceStatus, setVoiceStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');

    const [language, setLanguage] = useState(localStorage.getItem('language') || 'en');

    useEffect(() => {
        localStorage.setItem('language', language);
    }, [language]);
    const [connectionError, setConnectionError] = useState(false);
    const [activeTab, setActiveTab] = useState<'home' | 'agriculture' | 'scanner' | 'skills' | 'settings'>('home');

    const [courses, setCourses] = useState<any[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        const storedToken = sessionStorage.getItem('token');
        const storedUser = sessionStorage.getItem('username');
        const storedDisplayName = sessionStorage.getItem('display_name');
        const storedAvatarUrl = sessionStorage.getItem('avatar_url');

        if (storedToken) {
            setToken(storedToken);
            setUsername(storedUser);
            setDisplayName(storedDisplayName);
            setAvatarUrl(storedAvatarUrl);
        }

        const legacyItems = ['token', 'username', 'display_name', 'avatar_url'];
        legacyItems.forEach(item => {
            if (localStorage.getItem(item)) {
                localStorage.removeItem(item);
            }
        });
    }, []);

    useEffect(() => {
        if (!token) return;

        const fetchData = () => {
            const headers = { 'Authorization': `Bearer ${token}` };

            setIsLoadingHistory(true);

            fetch('/api/chat/history', { headers })
                .then(res => {
                    if (res.status === 401) throw new Error("Unauthorized");
                    return res.json();
                })
                .then(historyJson => {
                    if (Array.isArray(historyJson)) {
                        const parsedHistory = historyJson.map((msg: any) => ({
                            ...msg,
                            timestamp: new Date(msg.timestamp)
                        }));
                        setMessages(parsedHistory);
                    }
                })
                .catch(err => {
                    if (err.message === "Unauthorized") {
                        handleLogout();
                    }
                })
                .finally(() => setIsLoadingHistory(false));

            fetch('/api/auth/profile', { headers })
                .then(res => res.json())
                .then(profileJson => {
                    if (profileJson.display_name) {
                        setDisplayName(profileJson.display_name);
                        sessionStorage.setItem('display_name', profileJson.display_name);
                    }
                    if (profileJson.avatar_url) {
                        setAvatarUrl(profileJson.avatar_url);
                        try {
                            sessionStorage.setItem('avatar_url', profileJson.avatar_url);
                        } catch (e) {}
                    }
                })
                .catch(err => console.error("Failed to fetch profile:", err));

            fetch(`/api/market/courses?language=${language}`)
                .then(res => res.json())
                .then(coursesJson => setCourses(coursesJson))
                .catch(err => console.error("Failed to fetch courses:", err));
        };
        fetchData();

        if ('speechSynthesis' in window) {
            window.speechSynthesis.getVoices();
        }
    }, [token, language]);

    const handleLogin = (newToken: string, newUsername: string) => {
        sessionStorage.setItem('token', newToken);
        sessionStorage.setItem('username', newUsername);
        setToken(newToken);
        setUsername(newUsername);
    };

    const handleLogout = () => {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('username');
        sessionStorage.removeItem('display_name');
        sessionStorage.removeItem('avatar_url');
        setToken(null);
        setUsername(null);
        setDisplayName(null);
        setAvatarUrl(null);
        setMessages([]);
    };

    const uiStrings: { [key: string]: any } = {
        en: {
            listening: 'Listening...', thinking: 'Thinking...', speaking: 'Speaking...', tapToSpeak: 'Tap to Speak', tapToStop: 'Tap to Stop', scanner: 'Scan',
            home: 'Home', agriculture: 'Agriculture', skills: 'Skills', settings: 'Settings',
            marketHeader: 'Market Intelligence', skillsHeader: 'Agricultural Education',
            rates: 'Mandi Rates', vehicles: 'Agriculture Vehicles', schemes: 'Govt Schemes', marketing: 'Marketing & Success', advice: 'Cultivation Advice',
            ratesDesc: 'Check daily market prices for crops in your mandi.', vehiclesDesc: 'Tractors, harvesters, and transport vehicle prices.', schemesDesc: 'Central and State schemes for subsidies and loans.', marketingDesc: 'Success stories, bloggers, and selling strategies.', forecastingDesc: '7-day AI predictions for crop market prices.', forecasting: 'Forecasting',
            apply: 'Apply Now', watch: 'Watch Video', open: 'Open', back: 'Back'
        },
        // ... (Keep simplified English fallback, the rest are in components anyway)
    };

    const currentUI = uiStrings[language] || uiStrings['en'];

    const stopSpeaking = () => {
        window.speechSynthesis.cancel();
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current = null;
        }
        setVoiceStatus('idle');
        return true;
    };

    const audioPipeline = useAudioPipeline({
        token: token ?? undefined,
        useFallback: true,
    });

    useEffect(() => {
        if (!audioPipeline.isRecording && voiceStatus === 'listening') {
            const blob = audioPipeline.getRecordedBlob();
            if (blob && blob.size > 0) {
                handleChat(null, blob);
            } else {
                setVoiceStatus('idle');
            }
        }
    }, [audioPipeline.isRecording, voiceStatus, audioPipeline]);

    const handleMicClick = () => {
        if (voiceStatus === 'speaking' || voiceStatus === 'thinking' || window.speechSynthesis.speaking) {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
            stopSpeaking();
            return;
        }

        if (voiceStatus === 'listening' || audioPipeline.isRecording) {
            audioPipeline.stopRecording();
            return;
        }

        if (voiceStatus === 'idle') {
            audioPipeline.startRecording().then(() => {
                setVoiceStatus('listening');
            }).catch((err) => {
                console.error('Mic access denied:', err);
                alert('Microphone access is required for voice communication.');
            });
        }
    };

    const playAudioResponse = (url: string) => {
        stopSpeaking();
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onplay = () => setVoiceStatus('speaking');
        audio.onended = () => { setVoiceStatus('idle'); audioRef.current = null; };
        audio.onerror = () => { setVoiceStatus('idle'); audioRef.current = null; };
        audio.play().catch(() => { setVoiceStatus('idle'); audioRef.current = null; });
    };

    const fetchAndPlayTTS = async (text: string, overrideLanguage?: string) => {
        setVoiceStatus('thinking');
        if (!abortControllerRef.current) abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;
        const ttsLang = overrideLanguage || language;

        try {
            const ttsResponse = await fetch('/api/chat/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
                body: JSON.stringify({ text: text, language: ttsLang }),
                signal: signal
            });
            if (ttsResponse.ok) {
                const ttsData = await ttsResponse.json();
                if (ttsData.audio_url) playAudioResponse(ttsData.audio_url);
                else setVoiceStatus('idle');
            } else {
                setVoiceStatus('idle');
            }
        } catch (error: any) {
            if (error.name === 'AbortError') return;
            setVoiceStatus('idle');
        }
    };

    const deleteMessage = async (id: string) => {
        try {
            const res = await fetch(`/api/chat/history/${id}`, {
                method: 'DELETE',
                headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
            });
            if (res.status === 401) return handleLogout();
            setMessages(prev => prev.filter(m => m.id !== id));
        } catch (_err) {}
    };

    const clearHistory = async () => {
        try {
            const res = await fetch(`/api/chat/history`, {
                method: 'DELETE',
                headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
            });
            if (res.status === 401) return handleLogout();
            setMessages([]);
        } catch (_err) {}
    };

    const handleChat = async (text: string | null, audioBlob: Blob | null = null) => {
        setVoiceStatus('thinking');
        if (abortControllerRef.current) abortControllerRef.current.abort();
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        try {
            const formData = new FormData();
            if (audioBlob) formData.append('audio', audioBlob, 'input.webm');
            else if (text) formData.append('message', text);
            formData.append('language', language);
            formData.append('voice_enabled', 'false');

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: token ? { 'Authorization': `Bearer ${token}` } : undefined,
                body: formData,
                signal: signal
            });

            if (response.status === 401) return handleLogout();
            if (!response.ok) throw new Error("Server error");

            const data = await response.json();
            const userMsg: Message = { id: Date.now().toString(), text: data.user_text || text || "Voice Input", sender: 'user', timestamp: new Date() };
            const aiMsg: Message = { id: (Date.now() + 1).toString(), text: data.response_text, sender: 'ai', timestamp: new Date() };

            setMessages(prev => [...prev, userMsg, aiMsg]);

            if (audioBlob || text) {
                const summary = data.response_text.split('|||')[0].trim();
                await fetchAndPlayTTS(summary, data.detected_language);
            } else {
                setVoiceStatus('idle');
            }
        } catch (error: any) {
            if (error.name === 'AbortError') return;
            setVoiceStatus('idle');
            setConnectionError(true);
            setTimeout(() => setConnectionError(false), 5000);
        }
    };

    if (!token) {
        return (
            <div className="flex h-[100dvh] w-full bg-background items-center justify-center relative overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />
                <Auth onLogin={handleLogin} />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[100dvh] w-full bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-50 font-sans overflow-hidden antialiased relative">
            <main className="flex-1 flex flex-col relative pb-[80px] overflow-hidden min-h-0"> {/* Bottom nav padding */}
                <header className="w-full px-6 py-4 flex justify-between items-center z-10 shrink-0 bg-slate-950/80 backdrop-blur-md border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <img src="/logo.png" alt="Logo" className="w-8 h-8 rounded-full" />
                        <div className="text-lg font-semibold text-white/50">EventHorizon</div>
                    </div>
                    <LanguageSelector currentLanguage={language} onLanguageChange={setLanguage} />
                </header>

                {connectionError && (
                    <div className="absolute top-20 z-50 left-4 right-4 bg-red-500/90 text-white px-4 py-3 rounded-lg flex items-center gap-3 backdrop-blur-sm animate-bounce-in shadow-xl">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <span className="text-sm">Could not connect to server.</span>
                    </div>
                )}

                {activeTab === 'home' ? (
                    <div className="flex flex-col h-full w-full relative">
                        <div className="flex-1 overflow-y-auto px-4 pb-20 custom-scrollbar scroll-smooth pt-4">
                            {isLoadingHistory ? (
                                <div className="flex flex-col items-center justify-center h-full text-center opacity-80">
                                    <div className="w-10 h-10 rounded-full border-t-2 border-r-2 border-blue-500 animate-spin mb-4" />
                                    <h2 className="text-lg font-medium text-slate-300 animate-pulse">Loading history...</h2>
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center opacity-60">
                                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6 overflow-hidden border border-white/10 shadow-lg">
                                        <img src="/logo.png" alt="EventHorizon AI" className="w-full h-full object-cover" />
                                    </div>
                                    <h2 className="text-xl font-bold mb-2">EventHorizon AI</h2>
                                    <p className="text-gray-400 text-sm max-w-xs mx-auto">
                                        Your intelligent assistant. Tap the mic or type to start.
                                    </p>
                                    {voiceStatus === 'listening' && <p className="mt-6 text-lg text-blue-400 animate-pulse font-medium">{currentUI.listening}</p>}
                                    {voiceStatus === 'thinking' && <p className="mt-6 text-lg text-purple-400 animate-pulse font-medium">{currentUI.thinking}</p>}
                                    {voiceStatus === 'speaking' && <p className="mt-6 text-lg text-blue-400 font-medium">{currentUI.speaking}</p>}
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <ChatBox messages={messages} onReadAloud={fetchAndPlayTTS} />
                                    {voiceStatus === 'thinking' && (
                                        <div className="flex gap-4 animate-fade-in pl-2">
                                            <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
                                                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-ping" />
                                            </div>
                                            <div className="bg-white/5 rounded-2xl rounded-tl-none p-3 border border-white/10 flex items-center">
                                                <span className="text-gray-300 text-xs">{currentUI.thinking}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            <div id="scroll-anchor" className="h-4" />
                        </div>
                        <MobileInteractiveAIInput
                            voiceStatus={voiceStatus}
                            onMicClick={handleMicClick}
                            onSubmitText={(text) => handleChat(text)}
                            networkQuality={audioPipeline.networkQuality}
                            streamState={audioPipeline.streamState}
                            bufferedChunks={audioPipeline.bufferedChunks}
                            waveformLevel={audioPipeline.waveformLevel}
                            recordingDuration={audioPipeline.recordingDuration}
                            isRecording={audioPipeline.isRecording}
                        />
                    </div>
                ) : activeTab === 'scanner' ? (
                    <MobileVisualScanner language={language} token={token} onBack={() => setActiveTab('home')} />
                ) : activeTab === 'agriculture' ? (
                    <MobileMarketDashboard
                        onBack={() => setActiveTab('home')}
                        currentLanguage={language}
                        labels={currentUI}
                    />
                ) : activeTab === 'skills' ? (
                    <MobileSkillsDashboard
                        onBack={() => setActiveTab('home')}
                        courses={courses}
                        headerText={currentUI.skillsHeader}
                        labels={currentUI}
                    />
                ) : (
                    <MobileSettings
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
                                sessionStorage.setItem('display_name', updates.displayName);
                            }
                            if (updates.avatarUrl !== undefined) {
                                setAvatarUrl(updates.avatarUrl);
                                try { sessionStorage.setItem('avatar_url', updates.avatarUrl); } catch (e) {}
                            }
                        }}
                        onLogout={handleLogout}
                    />
                )}
            </main>

            <MobileSidebar
                activeTab={activeTab}
                setActiveTab={(tab: any) => setActiveTab(tab)}
                labels={{
                    home: currentUI.home || 'Home',
                    agriculture: currentUI.agriculture || 'Agri',
                    scanner: currentUI.scanner || 'Scan',
                    skills: currentUI.skills || 'Skills',
                    settings: currentUI.settings || 'Settings'
                }}
            />
        </div>
    );
}

export default MobileApp;
