import { useEffect } from 'react';
import { useWakeWord } from '../hooks/useWakeWord';
import { Mic, MicOff } from 'lucide-react';

export default function WakeWord() {
  const { isWakeWordActive, startWakeWordListener, stopWakeWordListener } = useWakeWord();

  // Auto-start wake word listening when component mounts
  useEffect(() => {
    startWakeWordListener();
    return () => stopWakeWordListener();
  }, []);

  return (
    <div className="flex items-center">
      <button
        onClick={() => {
          if (isWakeWordActive) {
            stopWakeWordListener();
          } else {
            startWakeWordListener();
          }
        }}
        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold shadow-sm transition-all border cursor-pointer ${
          isWakeWordActive
            ? 'bg-[#eef7f2] border-[#d2edd7] text-[#1A4731]'
            : 'bg-white border-[#eaeae0] text-[#8b9b8b] hover:border-[#F5A623]'
        }`}
        title={isWakeWordActive ? 'Stop Voice Activation' : 'Start Voice Activation'}
      >
        {isWakeWordActive ? (
          <>
            <Mic className="h-3.5 w-3.5 text-[#F5A623] animate-pulse" />
            <span>Hey Horizon (On)</span>
          </>
        ) : (
          <>
            <MicOff className="h-3.5 w-3.5 text-[#8b9b8b]" />
            <span>Voice Wake (Off)</span>
          </>
        )}
      </button>
    </div>
  );
}
