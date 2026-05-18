import { useEffect, useRef, useState } from 'react';
import { useUserStore } from '../store/userStore';

export function useWakeWord() {
  const recognitionRef = useRef<any>(null);
  const [isWakeWordActive, setIsWakeWordActive] = useState(false);
  const setIsListening = useUserStore((state) => state.setIsListening);
  const isListening = useUserStore((state) => state.isListening);
  const activeLanguage = useUserStore((state) => state.activeLanguage);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[WAKE WORD] SpeechRecognition is not supported in this browser.');
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    
    // Dynamically map active UI language to native SpeechRecognition language model
    const langMap: Record<string, string> = {
      en: 'en-IN',
      ta: 'ta-IN',
      hi: 'hi-IN',
      te: 'te-IN',
      kn: 'kn-IN',
      ml: 'ml-IN',
      bn: 'bn-IN',
      mr: 'mr-IN',
      gu: 'gu-IN'
    };
    rec.lang = langMap[activeLanguage] || 'en-IN';

    rec.onresult = (event: any) => {
      const resultIndex = event.resultIndex;
      const transcript = event.results[resultIndex][0].transcript.toLowerCase();
      
      // Highly robust multi-lingual and phonetic keyword matching
      const matchWords = [
        'horizon', 'orizon', 'ryzen', 'harizan', 'harison', 'herizen', 'horisen', 'horison', 'harisen',
        'ஹொரைசன்', 'ஹே ஹொரைசன்', 'ஹோரைசன்', 'ஹாரைசன்',
        'होराइज़न', 'होराइजन', 'होरिजोन', 'हे होराइज़न',
        'హోరిజోన్',
        'ಹೊರೈಜನ್',
        'ഹൊറൈസൺ',
        'হরাইজন',
        'होरायझन',
        'હોરાઇઝન'
      ];
      
      const isWakeWordMatched = matchWords.some(word => transcript.includes(word));
      
      if (isWakeWordMatched) {
        console.log('[WAKE WORD TRIGGERED] Detected wake word with text:', transcript);
        setIsListening(true);
        
        // Dispatch wake up event
        window.dispatchEvent(new CustomEvent('eventhorizon_wakeup'));
        
        // Haptic feedback for mobile devices
        if (navigator.vibrate) {
          navigator.vibrate([100, 50, 100]);
        }
      }
    };

    rec.onerror = (event: any) => {
      console.warn('[WAKE WORD ERROR]', event.error);
      if (event.error === 'not-allowed') {
        setIsWakeWordActive(false);
      }
    };

    const safeStart = () => {
      if (recognitionRef.current && isWakeWordActive && !isListening) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          // Already running or starting
        }
      }
    };

    rec.onend = () => {
      // Auto restart background wake word recognition with a safe throttle
      if (isWakeWordActive && !isListening) {
        setTimeout(() => {
          safeStart();
        }, 300);
      }
    };

    recognitionRef.current = rec;

    if (isWakeWordActive && !isListening) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        // Already running
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [isWakeWordActive, isListening, setIsListening, activeLanguage]);

  const startWakeWordListener = () => {
    setIsWakeWordActive(true);
    console.log('[WAKE WORD] continuous wake word listener started.');
  };

  const stopWakeWordListener = () => {
    setIsWakeWordActive(false);
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }
    console.log('[WAKE WORD] continuous wake word listener stopped.');
  };

  return {
    isWakeWordActive,
    startWakeWordListener,
    stopWakeWordListener
  };
}
