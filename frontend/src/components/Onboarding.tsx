import React, { useState, useEffect } from 'react';
import { Globe, MapPin, Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';
import CustomSelect from './CustomSelect';

interface OnboardingProps {
    token: string;
    onComplete: (data: { language: string, state: string, district: string, mandal: string }) => void;
}

const LANGUAGES = [
    { code: 'en', name: 'English', native: 'English' },
    { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
    { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
    { code: 'te', name: 'Telugu', native: 'తెలుగు' },
    { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
    { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
    { code: 'bn', name: 'Bengali', native: 'বাংলা' },
    { code: 'mr', name: 'Marathi', native: 'मराठी' },
    { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
];

export default function Onboarding({ token, onComplete }: OnboardingProps) {
    const [step, setStep] = useState<1 | 2>(1);
    
    // Language state
    const [language, setLanguage] = useState('en');
    
    // Location state
    const [locationTree, setLocationTree] = useState<Record<string, string[]>>({});
    const [selectedState, setSelectedState] = useState('');
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [mandal, setMandal] = useState('');
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch('/api/harvestiq/locations')
            .then(r => r.ok ? r.json() : {})
            .then(tree => {
                setLocationTree(tree);
            })
            .catch(() => { /* ignore */ });
    }, []);

    const states = Object.keys(locationTree).sort();
    const availableDistricts = selectedState ? (locationTree[selectedState] || []) : [];

    // Ensure district resets if state changes
    useEffect(() => {
        if (!availableDistricts.includes(selectedDistrict)) {
            setSelectedDistrict('');
        }
    }, [selectedState, availableDistricts, selectedDistrict]);

    const handleNext = () => {
        if (step === 1 && language) {
            setStep(2);
        }
    };

    const handleFinish = async () => {
        if (!selectedState || !selectedDistrict || !mandal.trim()) {
            setError('Please complete all location fields.');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            const res = await fetch('/api/auth/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    language,
                    state: selectedState,
                    district: selectedDistrict,
                    mandal: mandal.trim(),
                    onboarding_completed: true
                })
            });

            if (!res.ok) {
                throw new Error('Failed to save profile details');
            }

            onComplete({ language, state: selectedState, district: selectedDistrict, mandal: mandal.trim() });
        } catch (err: any) {
            setError(err.message || 'An error occurred while saving.');
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 text-slate-50 overflow-y-auto">
            {/* Background effects */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative z-10 w-full max-w-2xl px-6 py-12 animate-slide-up">
                {/* Header */}
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent mb-3">
                        Welcome to EventHorizon AI
                    </h1>
                    <p className="text-gray-400 text-lg">
                        Let's personalize your experience.
                    </p>
                </div>

                {/* Main Card */}
                <div className="glass-panel rounded-3xl p-8 border border-white/10 shadow-2xl bg-black/40 backdrop-blur-xl relative overflow-hidden">
                    {/* Step Indicator */}
                    <div className="flex items-center gap-2 mb-8">
                        <div className={`h-2 flex-1 rounded-full ${step >= 1 ? 'bg-blue-500' : 'bg-white/10'} transition-colors duration-500`} />
                        <div className={`h-2 flex-1 rounded-full ${step >= 2 ? 'bg-blue-500' : 'bg-white/10'} transition-colors duration-500`} />
                    </div>

                    {error && (
                        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-3">
                            {error}
                        </div>
                    )}

                    {step === 1 ? (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                                    <Globe className="w-6 h-6 text-blue-400" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-semibold">Select Language</h2>
                                    <p className="text-gray-400">Choose your preferred language</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {LANGUAGES.map((lang) => (
                                    <button
                                        key={lang.code}
                                        onClick={() => setLanguage(lang.code)}
                                        className={`p-4 rounded-2xl border transition-all duration-200 text-left relative overflow-hidden group
                                            ${language === lang.code 
                                                ? 'bg-blue-600/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]' 
                                                : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                                            }
                                        `}
                                    >
                                        <div className="font-semibold text-lg">{lang.native}</div>
                                        <div className="text-sm text-gray-400">{lang.name}</div>
                                        {language === lang.code && (
                                            <div className="absolute top-3 right-3 text-blue-400">
                                                <CheckCircle2 className="w-5 h-5" />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={handleNext}
                                disabled={!language}
                                className="w-full mt-8 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-lg font-semibold py-4 rounded-2xl transition-all duration-200 flex items-center justify-center gap-2 group"
                            >
                                Continue <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                                    <MapPin className="w-6 h-6 text-emerald-400" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-semibold">Where are you from?</h2>
                                    <p className="text-gray-400">This helps us provide accurate agricultural insights.</p>
                                </div>
                            </div>

                            <div className="space-y-5">
                                <CustomSelect
                                    label="Select State"
                                    value={selectedState}
                                    onChange={(v) => { setSelectedState(v); setSelectedDistrict(''); }}
                                    options={states}
                                    placeholder="Search state..."
                                />

                                <CustomSelect
                                    label="Select District"
                                    value={selectedDistrict}
                                    onChange={setSelectedDistrict}
                                    options={availableDistricts}
                                    placeholder={selectedState ? "Search district..." : "Select a state first"}
                                    disabled={!selectedState || availableDistricts.length === 0}
                                />

                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-gray-400 ml-1">Mandal / Taluk</label>
                                    <input
                                        type="text"
                                        value={mandal}
                                        onChange={(e) => setMandal(e.target.value)}
                                        placeholder="Enter your Mandal or Taluk..."
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-emerald-500/50 transition-colors"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 mt-8">
                                <button
                                    onClick={() => setStep(1)}
                                    disabled={isSubmitting}
                                    className="px-6 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 font-semibold transition-all"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleFinish}
                                    disabled={!selectedState || !selectedDistrict || !mandal.trim() || isSubmitting}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-lg font-semibold py-4 rounded-2xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
                                >
                                    {isSubmitting ? (
                                        <><Loader2 className="w-5 h-5 animate-spin" /> Saving...</>
                                    ) : (
                                        <><CheckCircle2 className="w-5 h-5" /> Complete Setup</>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
