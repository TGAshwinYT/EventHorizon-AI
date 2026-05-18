import { useState, useRef, useCallback, useEffect } from 'react';

interface UseVoiceRecorderReturn {
    isRecording: boolean;
    audioBlob: Blob | null;
    startRecording: () => Promise<void>;
    stopRecording: () => void;
    clearRecording: () => void;
}

// Helper function to create active Web Audio bandpass filters & compressor
function createNoiseReductionPipeline(stream: MediaStream): { filteredStream: MediaStream; cleanup: () => void } {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      return { filteredStream: stream, cleanup: () => {} };
    }

    const audioCtx = new AudioContextClass();
    const source = audioCtx.createMediaStreamSource(stream);

    // Highpass filter: removes low frequency sub-bass hum, fan vibrations, table knocks (85Hz cuts sub-bass)
    const highpass = audioCtx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 85;

    // Lowpass filter: removes high-frequency static hiss, electric squeaks, computer fan hum
    const lowpass = audioCtx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 7500;

    // Compressor: acts as a dynamic level stabilizer to ensure balanced vocal levels
    const compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 30;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    const destination = audioCtx.createMediaStreamDestination();

    // Connect nodes: mic source -> highpass -> lowpass -> compressor -> media destination
    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(compressor);
    compressor.connect(destination);

    return {
      filteredStream: destination.stream,
      cleanup: () => {
        source.disconnect();
        highpass.disconnect();
        lowpass.disconnect();
        compressor.disconnect();
        if (audioCtx.state !== 'closed') {
          audioCtx.close().catch(() => {});
        }
      }
    };
  } catch (error) {
    console.warn('[NoiseReductionPipeline] Web Audio setup failed, falling back to raw stream:', error);
    return { filteredStream: stream, cleanup: () => {} };
  }
}

export const useVoiceRecorder = (): UseVoiceRecorderReturn => {
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const pipelineCleanupRef = useRef<(() => void) | null>(null);

    // Clean up on unmount
    useEffect(() => {
        return () => {
            pipelineCleanupRef.current?.();
        };
    }, []);

    const startRecording = useCallback(async () => {
        try {
            // 1. Request microphone with WebRTC software-level noise reduction and echo cancellation
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1
                }
            });
            
            // 2. Route stream through our Web Audio studio noise reduction filter pipeline
            const { filteredStream, cleanup } = createNoiseReductionPipeline(stream);
            pipelineCleanupRef.current = cleanup;

            // 3. Record from the filtered isolated stream
            const mediaRecorder = new MediaRecorder(filteredStream);
            mediaRecorderRef.current = mediaRecorder;
            chunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                setAudioBlob(blob);
                
                // Stop all original and filtered tracks cleanly to release hardware
                stream.getTracks().forEach(track => track.stop());
                filteredStream.getTracks().forEach(track => track.stop());
                
                // Clean up Web Audio nodes and context
                pipelineCleanupRef.current?.();
                pipelineCleanupRef.current = null;
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('Could not access microphone. Please check permissions.');
        }
    }, []);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    }, [isRecording]);

    const clearRecording = useCallback(() => {
        setAudioBlob(null);
        chunksRef.current = [];
    }, []);

    return {
        isRecording,
        audioBlob,
        startRecording,
        stopRecording,
        clearRecording,
    };
};
