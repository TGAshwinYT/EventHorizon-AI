interface VoiceWaveformProps {
  active?: boolean;
}

export default function VoiceWaveform({ active = false }: VoiceWaveformProps) {
  const bars = Array.from({ length: 18 });

  return (
    <div className="flex items-center justify-center gap-1 h-14 w-full px-4 overflow-hidden">
      <style>{`
        @keyframes waveformPulse {
          0%, 100% {
            transform: scaleY(0.25);
          }
          50% {
            transform: scaleY(1.2);
          }
        }
        .wave-bar {
          transform-origin: center;
          transition: background-color 0.3s ease, height 0.3s ease;
        }
        .wave-bar.speaking {
          animation: waveformPulse 1s ease-in-out infinite;
          background: linear-gradient(180deg, #1A4731 0%, #F5A623 100%);
        }
      `}</style>
      
      {bars.map((_, i) => {
        // Calculate offset wave delay multiplier
        const delay = `${i * 0.05}s`;
        
        return (
          <div
            key={i}
            className={`w-1 rounded-full wave-bar ${active ? 'speaking' : 'bg-[#c0c0b0]'}`}
            style={{
              height: active ? '32px' : '6px',
              animationDelay: active ? delay : undefined
            }}
          />
        );
      })}
    </div>
  );
}
