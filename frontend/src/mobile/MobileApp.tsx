import { useState, useEffect, useCallback, useMemo } from 'react';
import MobileSidebar from './components/MobileSidebar';

import MobileMarketDashboard from './components/MobileMarketDashboard';
import MobileSettings from './components/MobileSettings';
import MobileVisualScanner from './components/MobileVisualScanner';
import MobileRiskDashboard from './components/MobileRiskDashboard';
import AgriDashboard from '../components/AgriDashboard';
import Auth from '../components/Auth';
import OnboardingFlow from '../components/OnboardingFlow';
import { AlertCircle } from 'lucide-react';

// Central Voice Assistant integrations
import { useUserStore } from '../store/userStore';
import FloatingAssistant from '../components/FloatingAssistant';
import AssistantDrawer from '../components/AssistantDrawer';
import WakeWord from '../components/WakeWord';
import AlertBell from '../components/AlertBell';

function MobileApp() {
    const [token, setToken] = useState<string | null>(sessionStorage.getItem('token'));
    const [username, setUsername] = useState<string | null>(sessionStorage.getItem('username'));
    const [displayName, setDisplayName] = useState<string | null>(sessionStorage.getItem('display_name'));
    const [avatarUrl, setAvatarUrl] = useState<string | null>(sessionStorage.getItem('avatar_url'));

    const [language, setLanguage] = useState(localStorage.getItem('language') || 'en');
    const [profileLoading, setProfileLoading] = useState(!!token);

    const setStoreToken = useUserStore((state) => state.setToken);
    const fetchProfile = useUserStore((state) => state.fetchProfile);
    const profile = useUserStore((state) => state.profile);

    // Persistent language change
    const handleLanguageChange = useCallback((newLang: string) => {
        setLanguage(newLang);
        localStorage.setItem('language', newLang);
        localStorage.setItem('event_horizon_lang', newLang);
        useUserStore.getState().setActiveLanguage(newLang);
        if (token) {
            fetch('/api/auth/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ language: newLang })
            }).catch(console.error);
        }
    }, [token]);

    const connectionError = false;
    const [activeTab, setActiveTab] = useState<'dashboard' | 'agriculture' | 'scanner' | 'risk' | 'settings'>('dashboard');
    const [agriSubView, setAgriSubView] = useState<'menu' | 'rates' | 'vehicles' | 'vehicle_details' | 'schemes' | 'forecasting' | 'marketing'>('menu');

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
            setStoreToken(storedToken);
        }

        const legacyItems = ['token', 'username', 'display_name', 'avatar_url'];
        legacyItems.forEach(item => {
            if (localStorage.getItem(item)) {
                localStorage.removeItem(item);
            }
        });
    }, []);

    useEffect(() => {
        if (token) {
            setStoreToken(token);
            setProfileLoading(true);
            fetchProfile().finally(() => {
                setProfileLoading(false);
            });
        } else {
            setProfileLoading(false);
        }
    }, [token]);

    // Update page title and notify page context analyzer on tab change on mobile
    useEffect(() => {
        const tabNames: { [key: string]: string } = {
            dashboard: 'Dashboard',
            agriculture: 'Market Intelligence',
            scanner: 'Visual Scanner',
            risk: 'Risk Assessment',
            settings: 'Settings'
        };
        const activeName = tabNames[activeTab] || 'Dashboard';
        document.title = `EventHorizon AI — ${activeName}`;
        
        // Dispatch location change event so SPA page context hooks pick it up instantly
        window.dispatchEvent(new Event('popstate'));
    }, [activeTab]);

    useEffect(() => {
        if (!token) return;

        const fetchData = () => {
            const headers = { 'Authorization': `Bearer ${token}` };

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
        setStoreToken(newToken);
    };

    const handleLogout = useCallback(() => {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('username');
        sessionStorage.removeItem('display_name');
        sessionStorage.removeItem('avatar_url');
        setToken(null);
        setUsername(null);
        setDisplayName(null);
        setAvatarUrl(null);
        setStoreToken(null);
    }, [setStoreToken]);

    const handleUpdateProfile = useCallback(async (updates: any) => {
        if (updates.displayName !== undefined) {
            setDisplayName(updates.displayName);
            sessionStorage.setItem('display_name', updates.displayName);
        }
        if (updates.avatarUrl !== undefined) {
            setAvatarUrl(updates.avatarUrl);
            try { sessionStorage.setItem('avatar_url', updates.avatarUrl); } catch (e) {}
        }
    }, []);

    const handleBackToDashboard = useCallback(() => setActiveTab('dashboard'), []);

    const uiStrings: { [key: string]: any } = {
        en: {
            listening: 'Listening...', thinking: 'Thinking...', speaking: 'Speaking...', tapToSpeak: 'Tap to Speak', tapToStop: 'Tap to Stop', scanner: 'Scan', risk: 'Risk', riskAssessment: 'Risk Assessment',
            home: 'Home', agriculture: 'Agriculture', skills: 'Skills', settings: 'Settings',
            marketHeader: 'Market Intelligence', skillsHeader: 'Agricultural Education',
            rates: 'Mandi Rates', vehicles: 'Agriculture Vehicles', schemes: 'Govt Schemes', marketing: 'Marketing & Success', advice: 'Cultivation Advice',
            ratesDesc: 'Check daily market prices for crops in your mandi.', vehiclesDesc: 'Tractors, harvesters, and transport vehicle prices.', schemesDesc: 'Central and State schemes for subsidies and loans.', marketingDesc: 'Success stories, bloggers, and selling strategies.', forecastingDesc: '7-day AI predictions for crop market prices.', forecasting: 'Forecasting',
            apply: 'Apply Now', watch: 'Watch Video', open: 'Open', back: 'Back'
        },
    };

    const currentUI = uiStrings[language] || uiStrings['en'];

    const sidebarLabels = useMemo(() => ({
        dashboard: currentUI.dashboard || 'Home',
        agriculture: currentUI.agriculture || 'Agri',
        scanner: currentUI.scanner || 'Scan',
        risk: currentUI.risk || 'Risk',
        settings: currentUI.settings || 'Settings'
    }), [currentUI]);

    if (!token) {
        return (
            <div className="flex h-[100dvh] w-full bg-[#0D1F16] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1A4731] via-[#0D1F16] to-[#050B08] items-center justify-center relative overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#F5A623]/10 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#4A90D9]/10 rounded-full blur-[100px] pointer-events-none" />
                <Auth onLogin={handleLogin} />
            </div>
        );
    }

    if (token && profileLoading) {
        return (
            <div className="flex h-[100dvh] w-full bg-[#0D1F16] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1A4731] via-[#0D1F16] to-[#050B08] items-center justify-center relative overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#F5A623]/10 rounded-full blur-[100px] pointer-events-none" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#4A90D9]/10 rounded-full blur-[100px] pointer-events-none" />
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#F5A623]"></div>
                    <div className="text-white/70 text-sm font-medium">Loading Profile...</div>
                </div>
            </div>
        );
    }

    if (token && profile && profile.onboarding_completed === false) {
        return (
            <OnboardingFlow 
                onComplete={() => {
                    fetchProfile().then(prof => {
                        if (prof) {
                            const userLang = prof.language || 'en';
                            setLanguage(userLang);
                            localStorage.setItem('language', userLang);
                            localStorage.setItem('event_horizon_lang', userLang);
                        }
                    });
                }} 
            />
        );
    }

    return (
        <div className="flex flex-col h-[100dvh] w-full bg-slate-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black text-slate-50 font-sans overflow-hidden antialiased relative">
            <main className="flex-1 flex flex-col relative pb-[80px] overflow-hidden min-h-0">
                <header className="w-full px-6 py-4 flex justify-between items-center z-40 shrink-0 bg-slate-950/80 backdrop-blur-md border-b border-white/5" style={{ transform: 'translateZ(0)' }}>
                    <div className="flex items-center gap-3">
                        <img src="/logo.png" alt="Logo" className="w-8 h-8 rounded-full" />
                        <div className="text-lg font-semibold text-white/50">EventHorizon</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <WakeWord />
                        <AlertBell />
                    </div>
                </header>

                {connectionError && (
                    <div className="absolute top-20 z-50 left-4 right-4 bg-red-500/90 text-white px-4 py-3 rounded-lg flex items-center gap-3 backdrop-blur-sm animate-bounce-in shadow-xl">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <span className="text-sm">Could not connect to server.</span>
                    </div>
                )}

                {activeTab === 'dashboard' ? (
                    <AgriDashboard
                        currentLanguage={language}
                        userLocation={profile ? { state: profile.state || 'Tamil Nadu', district: profile.district || 'Coimbatore', mandal: profile.mandal || '' } : null}
                        setActiveTab={setActiveTab}
                        setAgriSubView={setAgriSubView}
                        token={token}
                    />
                ) : activeTab === 'scanner' ? (
                    <MobileVisualScanner language={language} token={token} onBack={handleBackToDashboard} />
                ) : activeTab === 'risk' ? (
                    <MobileRiskDashboard
                        onBack={handleBackToDashboard}
                        currentLanguage={language}
                        labels={currentUI}
                    />
                ) : activeTab === 'agriculture' ? (
                    <MobileMarketDashboard
                        onBack={handleBackToDashboard}
                        currentLanguage={language}
                        labels={currentUI}
                        initialView={agriSubView}
                    />
                ) : activeTab === 'settings' ? (
                    <MobileSettings
                        onBack={handleBackToDashboard}
                        currentLanguage={language}
                        onLanguageChange={handleLanguageChange}
                        username={username}
                        displayName={displayName}
                        avatarUrl={avatarUrl}
                        token={token}
                        onUpdateProfile={handleUpdateProfile}
                        onLogout={handleLogout}
                    />
                ) : null}

                <FloatingAssistant />
                <AssistantDrawer />
            </main>

            <MobileSidebar
                activeTab={activeTab}
                setActiveTab={(tab) => {
                    setActiveTab(tab);
                    setAgriSubView('menu');
                }}
                labels={sidebarLabels}
            />
        </div>
    );
}

export default MobileApp;
