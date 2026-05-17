import { useState, useEffect, useCallback, useRef } from 'react';

// Using Web Speech API for Wake Word Detection (if available)
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export function useWakeWord(onWakeWordDetected: () => void) {
    const [isListeningForWakeWord, setIsListeningForWakeWord] = useState(false);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const recognitionRef = useRef<any>(null);

    const checkPermission = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            setHasPermission(true);
            return true;
        } catch (err) {
            console.error("Microphone permission denied", err);
            setHasPermission(false);
            return false;
        }
    };

    const startListening = useCallback(async () => {
        if (!SpeechRecognition) {
            console.warn("Speech Recognition API not supported in this browser.");
            return;
        }

        const perm = await checkPermission();
        if (!perm) return;

        if (!recognitionRef.current) {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US'; // We listen for "Hey Horizon" in English mostly

            recognition.onresult = (event: any) => {
                const current = event.resultIndex;
                const transcript = event.results[current][0].transcript.toLowerCase();
                
                if (transcript.includes('hey horizon') || transcript.includes('horizon')) {
                    console.log("Wake word detected!");
                    onWakeWordDetected();
                    // Optional: we can stop recognition here and restart it later
                    recognition.stop();
                }
            };

            recognition.onend = () => {
                // Auto-restart if we are supposed to be listening
                if (isListeningForWakeWord) {
                    try {
                        recognition.start();
                    } catch (e) {
                        console.error("Failed to restart speech recognition", e);
                    }
                }
            };

            recognitionRef.current = recognition;
        }

        try {
            recognitionRef.current.start();
            setIsListeningForWakeWord(true);
        } catch (e) {
            // Already started
            setIsListeningForWakeWord(true);
        }
    }, [isListeningForWakeWord, onWakeWordDetected]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        setIsListeningForWakeWord(false);
    }, []);

    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, []);

    return {
        isListeningForWakeWord,
        hasPermission,
        startListening,
        stopListening
    };
}
