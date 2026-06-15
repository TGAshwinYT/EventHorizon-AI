import { useEffect, useRef, useState } from 'react';
import { useUserStore } from '../store/userStore';

export function useWakeWord() {
  const recognitionRef = useRef<any>(null);
  const [isWakeWordActive, setIsWakeWordActive] = useState(false);
  const setIsListening = useUserStore((state) => state.setIsListening);
  const isListening = useUserStore((state) => state.isListening);
  const activeLanguage = useUserStore((state) => state.activeLanguage);

  const hasRecognitionStartedRef = useRef(false);

  const createRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[WAKE WORD] SpeechRecognition is not supported in this browser.');
      return null;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;

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
      const transcript = event.results[resultIndex][0]?.transcript?.toLowerCase() || '';

      const matchWords = [
        'horizon', 'orizon', 'ryzen', 'harizan', 'harison', 'herizen', 'horisen', 'horison', 'harisen',
        'ஹொரைசன்', 'ஹே ஹொரைசன்', 'ஹோரைசன்', 'ஹாரைசன்',
        'होराइज़न', 'होराइजन', 'होरिजोन', 'हे होराइज़न',
        'హోరిజోన్',
        'ಹೊರೈಜನ್',
        'ഹൊറൈസൺ',
        'হরাইজন',
        'होरायझन',
        'હોરાઇઝन'
      ];

      const isWakeWordMatched = matchWords.some(word => transcript.includes(word));
      if (isWakeWordMatched) {
        console.log('[WAKE WORD TRIGGERED] Detected wake word with text:', transcript);
        setIsListening(true);
        window.dispatchEvent(new CustomEvent('eventhorizon_wakeup'));
        if (navigator.vibrate) {
          navigator.vibrate([100, 50, 100]);
        }
      }
    };

    rec.onstart = () => {
      console.log('[WAKE WORD] recognition started.');
      hasRecognitionStartedRef.current = true;
    };

    rec.onend = () => {
      console.log('[WAKE WORD] recognition ended. active=', isWakeWordActive, 'listening=', isListening);
      hasRecognitionStartedRef.current = false;
      if (isWakeWordActive && !isListening) {
        setTimeout(() => {
          if (recognitionRef.current && !hasRecognitionStartedRef.current) {
            try {
              recognitionRef.current.start();
            } catch (e) {
              console.warn('[WAKE WORD] restart failed', e);
            }
          }
        }, 300);
      }
    };

    rec.onerror = (event: any) => {
      console.warn('[WAKE WORD ERROR]', event.error);
      hasRecognitionStartedRef.current = false;
      if (event.error === 'not-allowed') {
        setIsWakeWordActive(false);
      }
    };

    return rec;
  };

  useEffect(() => {
    if (!isWakeWordActive) {
      return;
    }

    if (!recognitionRef.current) {
      recognitionRef.current = createRecognition();
    }

    if (recognitionRef.current && !isListening && !hasRecognitionStartedRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.warn('[WAKE WORD] start failed', e);
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        hasRecognitionStartedRef.current = false;
      }
    };
  }, [isWakeWordActive, isListening, activeLanguage]);

  const startWakeWordListener = () => {
    setIsWakeWordActive(true);
    if (!recognitionRef.current) {
      recognitionRef.current = createRecognition();
    }
    if (recognitionRef.current && !isListening && !hasRecognitionStartedRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.warn('[WAKE WORD] start failed', e);
      }
    }
    console.log('[WAKE WORD] continuous wake word listener started.');
  };

  const stopWakeWordListener = () => {
    setIsWakeWordActive(false);
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      hasRecognitionStartedRef.current = false;
    }
    console.log('[WAKE WORD] continuous wake word listener stopped.');
  };

  return {
    isWakeWordActive,
    startWakeWordListener,
    stopWakeWordListener
  };
}
