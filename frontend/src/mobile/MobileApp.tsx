import { useState, useEffect, useRef } from 'react';
import MobileSidebar from './components/MobileSidebar';

import MobileMarketDashboard from './components/MobileMarketDashboard';
import MobileSettings from './components/MobileSettings';
import MobileVisualScanner from './components/MobileVisualScanner';
import MobileRiskDashboard from './components/MobileRiskDashboard';
import Auth from '../components/Auth';
import { AlertCircle } from 'lucide-react';

import FloatingAssistant from '../components/Assistant/FloatingAssistant';
import AssistantDrawer from '../components/Assistant/AssistantDrawer';
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
    const [activeTab, setActiveTab] = useState<'agriculture' | 'scanner' | 'risk' | 'settings'>('risk');
    const [isAssistantOpen, setIsAssistantOpen] = useState(false);


    const [messages, setMessages] = useState<Message[]>([]);


    const audioRef = useRef<HTMLAudioElement | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const audioQueueRef = useRef<string[]>([]);

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
                });

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
            listening: 'Listening...', thinking: 'Thinking...', speaking: 'Speaking...', tapToSpeak: 'Tap to Speak', tapToStop: 'Tap to Stop', scanner: 'Scan', risk: 'Risk', riskAssessment: 'Risk Assessment',
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
        audioQueueRef.current = [];
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

    const playAudioResponse = (url: string, onEnded?: () => void) => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onplay = () => setVoiceStatus('speaking');
        audio.onended = () => { 
            audioRef.current = null; 
            if (onEnded) onEnded(); else setVoiceStatus('idle');
        };
        audio.onerror = () => { 
            audioRef.current = null; 
            if (onEnded) onEnded(); else setVoiceStatus('idle');
        };
        audio.play().catch(() => { 
            audioRef.current = null; 
            if (onEnded) onEnded(); else setVoiceStatus('idle');
        });
    };

    const playNextAudioInQueue = () => {
        if (audioQueueRef.current.length === 0) {
            setVoiceStatus('idle');
            return;
        }
        const nextUrl = audioQueueRef.current.shift();
        if (nextUrl) {
            playAudioResponse(nextUrl, playNextAudioInQueue);
        }
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
            formData.append('page_context', activeTab);
            formData.append('voice_enabled', 'false');

            const response = await fetch('/api/chat/stream', {
                method: 'POST',
                headers: token ? { 'Authorization': `Bearer ${token}` } : undefined,
                body: formData,
                signal: signal
            });

            if (response.status === 401) return handleLogout();
            if (!response.ok) throw new Error("Server error");

            const userMsg: Message = { id: Date.now().toString(), text: text || "Voice Input", sender: 'user', timestamp: new Date() };
            const aiMsg: Message = { id: (Date.now() + 1).toString(), text: "", sender: 'ai', timestamp: new Date() };
            setMessages(prev => [...prev, userMsg, aiMsg]);

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let fullAiResponse = "";
            let isFirstChunk = true;

            if (reader) {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    
                    const chunkStr = decoder.decode(value, { stream: true });
                    const lines = chunkStr.split('\\n');
                    
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.substring(6));
                                if (data.type === 'metadata') {
                                    if (isFirstChunk) {
                                        setMessages(prev => prev.map(m => m.id === userMsg.id ? { ...m, text: data.user_text || text || "Voice Input" } : m));
                                        isFirstChunk = false;
                                    }
                                } else if (data.type === 'text') {
                                    fullAiResponse += data.text;
                                    setMessages(prev => prev.map(m => m.id === aiMsg.id ? { ...m, text: fullAiResponse } : m));
                                } else if (data.type === 'audio') {
                                    const audioUrl = `data:audio/mp3;base64,${data.audio_base64}`;
                                    audioQueueRef.current.push(audioUrl);
                                    if (!audioRef.current || audioRef.current.ended || audioRef.current.paused) {
                                        playNextAudioInQueue();
                                    }
                                } else if (data.type === 'complete') {
                                    if (audioQueueRef.current.length === 0 && !audioRef.current) {
                                        setVoiceStatus('idle');
                                    }
                                }
                            } catch(e) {}
                        }
                    }
                }
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
            <main className="flex-1 flex flex-col relative pb-[80px] overflow-hidden min-h-0">
                <FloatingAssistant onClick={() => setIsAssistantOpen(true)} isOpen={isAssistantOpen} />
                <AssistantDrawer 
                    isOpen={isAssistantOpen}
                    onClose={() => setIsAssistantOpen(false)}
                    messages={messages}
                    voiceStatus={voiceStatus}
                    onMicClick={handleMicClick}
                    onSubmitText={(text) => handleChat(text)}
                    networkQuality={audioPipeline.networkQuality}
                    streamState={audioPipeline.streamState}
                    bufferedChunks={audioPipeline.bufferedChunks}
                    waveformLevel={audioPipeline.waveformLevel}
                    recordingDuration={audioPipeline.recordingDuration}
                    isRecording={audioPipeline.isRecording}
                    onReadAloud={fetchAndPlayTTS}
                    currentUI={currentUI}
                    pageContextText={activeTab === 'risk' ? 'Risk Dashboard' : activeTab === 'agriculture' ? 'Market Intelligence' : activeTab === 'scanner' ? 'Plant Doctor' : 'Settings'}
                />

                <header className="w-full px-6 py-4 flex justify-between items-center z-10 shrink-0 bg-slate-950/80 backdrop-blur-md border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <img src="/logo.png" alt="Logo" className="w-8 h-8 rounded-full" />
                        <div className="text-lg font-semibold text-white/50">EventHorizon</div>
                    </div>

                </header>

                {connectionError && (
                    <div className="absolute top-20 z-50 left-4 right-4 bg-red-500/90 text-white px-4 py-3 rounded-lg flex items-center gap-3 backdrop-blur-sm animate-bounce-in shadow-xl">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <span className="text-sm">Could not connect to server.</span>
                    </div>
                )}

                {activeTab === 'scanner' ? (
                    <MobileVisualScanner language={language} token={token} onBack={() => setActiveTab('risk')} />
                ) : activeTab === 'risk' ? (
                    <MobileRiskDashboard
                        onBack={() => {}}
                        currentLanguage={language}
                        labels={currentUI}
                    />
                ) : activeTab === 'agriculture' ? (
                    <MobileMarketDashboard
                        onBack={() => setActiveTab('risk')}
                        currentLanguage={language}
                        labels={currentUI}
                    />
                ) : activeTab === 'settings' ? (
                    <MobileSettings
                        onBack={() => setActiveTab('risk')}
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
                ) : null}
            </main>

            <MobileSidebar
                activeTab={activeTab}
                setActiveTab={(tab: any) => setActiveTab(tab)}
                labels={{
                    agriculture: currentUI.agriculture || 'Agri',
                    scanner: currentUI.scanner || 'Scan',
                    risk: currentUI.risk || 'Risk',
                    settings: currentUI.settings || 'Settings'
                }}
            />
        </div>
    );
}

export default MobileApp;
