import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

interface GatekeeperProps {
    children: React.ReactNode;
}

const Gatekeeper: React.FC<GatekeeperProps> = ({ children }) => {
    const [isBackendReady, setIsBackendReady] = useState<boolean>(false);
    const [isError, setIsError] = useState<boolean>(false);

    useEffect(() => {
        let intervalId: NodeJS.Timeout;

        const checkHealth = async () => {
            try {
                const response = await fetch('/api/health');
                if (response.ok) {
                    const data = await response.json();
                    if (data.status === 'ready') {
                        setIsBackendReady(true);
                        setIsError(false);
                        clearInterval(intervalId);
                    }
                } else {
                    console.log('Backend is booting up...');
                }
            } catch (err) {
                console.log('Unable to reach backend. Retrying...');
            }
        };

        // Initial check
        checkHealth();

        // Poll every 2 seconds
        intervalId = setInterval(checkHealth, 2000);

        // Fallback timeout: If the backend truly fails to start within 30 seconds
        const timeoutId = setTimeout(() => {
            if (!isBackendReady) {
                setIsError(true);
                clearInterval(intervalId);
            }
        }, 30000);

        return () => {
            clearInterval(intervalId);
            clearTimeout(timeoutId);
        };
    }, [isBackendReady]);

    if (isBackendReady) {
        return <>{children}</>;
    }

    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-slate-100 p-4">
                <div className="bg-red-900/20 border border-red-500/50 p-8 rounded-2xl max-w-md text-center shadow-2xl backdrop-blur-sm">
                    <RefreshCw className="w-16 h-16 mx-auto mb-6 text-red-400" />
                    <h2 className="text-2xl font-bold mb-4 text-red-300">Connection Timeout</h2>
                    <p className="text-slate-300">
                        EventHorizon AI was unable to establish a link with the core servers.
                        Please ensure the backend API is running.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-6 px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors font-medium shadow-lg shadow-red-500/20"
                    >
                        Retry Connection
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-slate-100 overflow-hidden relative">
            {/* Dark background grid and ambient lighting */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-900 to-slate-950" />

            <div className="z-10 flex flex-col items-center">
                {/* Glowing Orb Animation */}
                <div className="relative mb-12">
                    {/* Outer glow rings */}
                    <div className="absolute -inset-4 bg-blue-500/20 rounded-full blur-xl animate-pulse" />
                    <div className="absolute -inset-8 bg-purple-500/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '1s' }} />

                    {/* Main Orb / Logo container */}
                    <div className="w-32 h-32 bg-white/5 rounded-full flex items-center justify-center overflow-hidden border border-white/20 shadow-[0_0_30px_rgba(59,130,246,0.5)] relative z-20">
                        <img src="/logo.png" alt="EventHorizon AI" className="w-full h-full object-cover opacity-90" />

                        {/* Shimmer effect over logo */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                    </div>
                </div>

                {/* Loading Text */}
                <h1 className="text-3xl font-bold tracking-tight mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    EventHorizon AI
                </h1>

                <div className="flex items-center space-x-3 text-slate-400">
                    <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                    </div>
                    <p className="font-medium animate-pulse">Warming up AI models and establishing neural links...</p>
                </div>

                <p className="mt-8 text-xs text-slate-500 max-w-xs text-center">
                    Powering up language processing, retrieving skill databases, and initializing the core loop.
                </p>
            </div>

            {/* Add custom keyframe for the shimmer if not in Tailwind config inherently */}
            <style>{`
                @keyframes shimmer {
                    100% {
                        transform: translateX(100%);
                    }
                }
            `}</style>
        </div>
    );
};

export default Gatekeeper;
