import { useUserStore } from '../store/userStore';
import { Mic } from 'lucide-react';

export default function FloatingAssistant() {
  const isListening = useUserStore((state) => state.isListening);
  const setIsListening = useUserStore((state) => state.setIsListening);
  const isSpeaking = useUserStore((state) => state.isSpeaking);

  // If the drawer is already open, hide the floating button
  if (isListening) return null;

  return (
    <div id="floating-assistant-orb" className="fixed bottom-24 md:bottom-6 right-6 z-[60]">
      {/* Glow Rings */}
      <span className={`absolute -inset-2 rounded-full bg-gradient-to-tr from-[#1A4731] to-[#F5A623] opacity-25 blur-md -z-10 ${
        isSpeaking ? 'animate-pulse' : 'animate-none'
      }`}></span>

      <button
        onClick={() => setIsListening(true)}
        className="relative flex items-center justify-center w-16 h-16 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 bg-gradient-to-tr from-[#1A4731] via-[#1A4731] to-[#F5A623] text-white border border-white/20 group cursor-pointer"
        aria-label="Ask Horizon"
      >
        {/* Ring Pulse */}
        <span className="absolute inset-0 rounded-full bg-[#1A4731]/30 -z-10 animate-ping opacity-60"></span>
        <span className="absolute inset-0 rounded-full bg-[#F5A623]/20 -z-10 animate-pulse opacity-40"></span>
        
        {/* Microphone icon */}
        <Mic className="h-7 w-7 group-hover:rotate-12 transition-transform duration-300" />
      </button>
    </div>
  );
}
