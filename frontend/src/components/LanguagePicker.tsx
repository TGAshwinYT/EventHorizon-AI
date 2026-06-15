import { useState, useEffect, useRef } from 'react';
import { useUserStore } from '../store/userStore';

interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flagText: string;
  subText: string;
}

const LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English', flagText: 'En', subText: 'Global' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', flagText: 'த', subText: 'தமிழ்நாடு' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिंदी', flagText: 'अ', subText: 'उत्तर भारत' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', flagText: 'అ', subText: 'ఆంధ్రప్రదేశ్ / తెలంగాణ' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', flagText: 'ಅ', subText: 'ಕರ್ನಾಟಕ' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', flagText: 'അ', subText: 'കേരളം' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flagText: 'অ', subText: 'पश्चिमबंग' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', flagText: 'म', subText: 'महाराष्ट्र' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', flagText: 'ੳ', subText: 'ਪੰਜਾਬ' }
];

const LANGUAGE_CODE_MAP: Record<string, string> = {
  ta: 'ta',
  tamil: 'ta',
  hi: 'hi',
  hindi: 'hi',
  te: 'te',
  telugu: 'te',
  kn: 'kn',
  kannada: 'kn',
  ml: 'ml',
  malayalam: 'ml',
  bn: 'bn',
  bengali: 'bn',
  mr: 'mr',
  marathi: 'mr',
  pa: 'pa',
  punjabi: 'pa',
  en: 'en'
};

export default function LanguagePicker({ onNext }: { onNext: () => void }) {
  const activeLanguage = useUserStore((state) => state.activeLanguage);
  const setActiveLanguage = useUserStore((state) => state.setActiveLanguage);

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSelect = (code: string) => {
    setActiveLanguage(code);
    onNext();
  };

  const startVoiceDetection = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Clean up tracks
        stream.getTracks().forEach(track => track.stop());
        await detectLanguageFromAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Automatically stop after 3.5 seconds
      recordingTimeoutRef.current = setTimeout(() => {
        stopVoiceDetection();
      }, 3500);

    } catch (e) {
      console.error('Microphone access failed:', e);
      alert('Microphone access is required for language detection.');
    }
  };

  const stopVoiceDetection = () => {
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const detectLanguageFromAudio = async (blob: Blob) => {
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'voice.webm');

      const res = await fetch('/api/assistant/voice/stt', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error('STT detection failed');

      const data = await res.json();
      const detected = data.language_detected || 'en';
      
      const mappedCode = LANGUAGE_CODE_MAP[detected.toLowerCase()];

      if (mappedCode) {
        const matchingLang = LANGUAGES.find(l => l.code === mappedCode);
        if (matchingLang) {
          setActiveLanguage(mappedCode);
          alert(`Detected Language: ${matchingLang.nativeName}`);
          onNext();
        } else {
          alert(`Detected: ${detected}, please select it manually in the list.`);
        }
      } else {
        alert("Language not recognized. Please select a card manually.");
      }
    } catch (e) {
      console.error(e);
      alert('Error detecting language. Please select manually.');
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    return () => {
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  return (
    <div className="w-full animate-fade-in">
      <div className="text-center mb-6">
        <h2 className="text-2xl md:text-3xl font-extrabold text-[#1A4731] tracking-tight">
          Select Your Language
        </h2>
        <p className="mt-2 text-sm md:text-base text-[#5a6e5a] font-medium">
          Select your language to begin talking with Horizon
        </p>
      </div>

      {/* Voice Recognition Section */}
      <div className="flex flex-col items-center justify-center bg-[#eef7f2] border border-[#d2edd7] rounded-3xl p-5 mb-8 text-center max-w-md mx-auto shadow-sm">
        <h3 className="text-sm font-extrabold text-[#1A4731] mb-1">
          Speak to Select
        </h3>
        <p className="text-[11px] text-[#5a6e5a] mb-4">
          Click the mic and speak in your native language (e.g. say "தமிழ்" or "हिंदी")
        </p>

        <button
          type="button"
          onClick={isRecording ? stopVoiceDetection : startVoiceDetection}
          disabled={isProcessing}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 relative outline-none ${
            isRecording
              ? 'bg-red-500 text-white animate-pulse'
              : 'bg-[#1A4731] hover:bg-[#123323] text-white hover:scale-105 shadow-md'
          }`}
        >
          {isRecording ? (
            <>
              <span className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />
              <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-red-500 rounded-full" />
              </div>
            </>
          ) : isProcessing ? (
            <svg className="animate-spin h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          )}
        </button>

        {isRecording && (
          <p className="text-xs text-red-500 font-bold mt-3 animate-pulse">
            Listening... Speak now!
          </p>
        )}
        {isProcessing && (
          <p className="text-xs text-[#1A4731] font-bold mt-3">
            Detecting language...
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
        {LANGUAGES.map((lang) => {
          const isSelected = activeLanguage === lang.code;
          return (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className={`relative flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all duration-300 text-center cursor-pointer group shadow-sm hover:shadow-md ${
                isSelected
                  ? 'border-[#1A4731] bg-[#eef7f2] scale-102'
                  : 'border-[#eaeae0] bg-white hover:border-[#F5A623] hover:bg-[#fafaf7]'
              }`}
            >
              {/* Selected Badge */}
              {isSelected && (
                <span className="absolute top-2.5 right-2.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1A4731] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1A4731]"></span>
                </span>
              )}

              {/* Stylized native script character badge */}
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-extrabold mb-2.5 transition-transform duration-300 group-hover:scale-110 ${
                isSelected
                  ? 'bg-[#1A4731] text-white shadow-sm'
                  : 'bg-[#eef7f2] text-[#1A4731] border border-[#d2edd7]'
              }`}>
                {lang.flagText}
              </div>

              <div className="text-center w-full">
                <div className="font-bold text-[#1A4731] text-base mb-0.5 leading-tight">
                  {lang.nativeName}
                </div>
                <div className="text-[10px] font-semibold text-[#8b9b8b] uppercase tracking-wider">
                  {lang.name}
                </div>
                <div className="text-[9px] text-[#b0c0b0] mt-0.5 italic leading-none">
                  {lang.subText}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
