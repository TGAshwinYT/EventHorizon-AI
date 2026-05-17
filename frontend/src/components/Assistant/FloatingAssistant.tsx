import React from 'react';
import { MessageCircle, Mic, MicOff } from 'lucide-react';
import { useWakeWord } from '../../hooks/useWakeWord';

interface FloatingAssistantProps {
    onClick: () => void;
    isOpen: boolean;
}

const FloatingAssistant: React.FC<FloatingAssistantProps> = ({ onClick, isOpen }) => {
    const { isListeningForWakeWord, startListening, stopListening } = useWakeWord(() => {
        // When wake word is detected, open the assistant and trigger mic
        onClick();
        // A slight delay allows the drawer to open before clicking the mic inside it
        setTimeout(() => {
            const micBtn = document.getElementById('drawer-mic-btn');
            if (micBtn) micBtn.click();
        }, 300);
    });

    if (isOpen) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
            {isListeningForWakeWord && (
                <div className="bg-primary-light/90 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm animate-fade-in shadow-lg flex items-center gap-2 border border-primary">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                    Listening for "Hey Horizon"
                </div>
            )}
            
            <div className="flex items-center gap-3">
                <button
                    onClick={isListeningForWakeWord ? stopListening : startListening}
                    className="w-10 h-10 rounded-full bg-background-dark/80 backdrop-blur-sm border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors shadow-lg"
                    title={isListeningForWakeWord ? "Stop listening for wake word" : "Start listening for 'Hey Horizon'"}
                >
                    {isListeningForWakeWord ? <Mic className="w-4 h-4 text-secondary" /> : <MicOff className="w-4 h-4 text-white/50" />}
                </button>

                <button
                    onClick={onClick}
                    className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary shadow-2xl flex items-center justify-center hover:scale-110 transition-transform duration-300 group relative"
                    aria-label="Open Assistant"
                >
                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                    <MessageCircle className="w-8 h-8 text-white group-hover:animate-pulse relative z-10" />
                </button>
            </div>
        </div>
    );
};

export default FloatingAssistant;
