import { useState, useRef, useEffect } from 'react';
import { useUserStore } from '../store/userStore';
import { geminiService } from '../services/gemini';
import { groqService } from '../services/groq';

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

// ⭕ High-Performance pre-allocated Circular Queue (Ring Buffer) for Audio Blobs in O(1)
class CircularBlobBuffer {
  private buffer: Blob[];
  private head: number;
  private tail: number;
  private capacity: number;
  private count: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }

  public push(blob: Blob) {
    this.buffer[this.head] = blob;
    this.head = (this.head + 1) % this.capacity;
    
    if (this.count < this.capacity) {
      this.count++;
    } else {
      // Overwrite least recent tail node
      this.tail = (this.tail + 1) % this.capacity;
    }
  }

  public clear() {
    this.head = 0;
    this.tail = 0;
    this.count = 0;
    this.buffer.fill(null as any);
  }

  public toArray(): Blob[] {
    const result: Blob[] = [];
    let idx = this.tail;
    for (let i = 0; i < this.count; i++) {
      result.push(this.buffer[idx]);
      idx = (idx + 1) % this.capacity;
    }
    return result;
  }
}

// 🧠 Custom LRU (Least Recently Used) Chat Message Node
interface LRUMessageNode {
  role: string;
  content: string;
  key: string;
  prev?: LRUMessageNode;
  next?: LRUMessageNode;
}

// ⚡ Doubly Linked List + Hash Map LRU Cache to prune payload tokens in O(1) constant time
class LRUChatCache {
  private capacity: number;
  private cache: Map<string, LRUMessageNode>;
  private head?: LRUMessageNode;
  private tail?: LRUMessageNode;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.cache = new Map();
  }

  public put(role: string, content: string) {
    const key = `${role}_${Math.random()}`;
    const node: LRUMessageNode = { role, content, key };
    
    if (this.cache.size >= this.capacity) {
      this.evictLeastRecent();
    }
    
    this.cache.set(key, node);
    this.addToHead(node);
  }

  public getOrderedMessages(): { role: string; content: string }[] {
    const result: { role: string; content: string }[] = [];
    let current = this.tail;
    while (current) {
      result.push({ role: current.role, content: current.content });
      current = current.prev;
    }
    return result;
  }

  private addToHead(node: LRUMessageNode) {
    node.next = this.head;
    node.prev = undefined;
    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;
    if (!this.tail) {
      this.tail = node;
    }
  }

  private evictLeastRecent() {
    if (!this.tail) return;
    this.cache.delete(this.tail.key);
    if (this.tail.prev) {
      this.tail = this.tail.prev;
      this.tail.next = undefined;
    } else {
      this.head = undefined;
      this.tail = undefined;
    }
  }
}

export function useVoice() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceLoading, setVoiceLoading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<CircularBlobBuffer>(new CircularBlobBuffer(500));
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPlaybackRef = useRef<HTMLAudioElement | null>(null);
  const pipelineCleanupRef = useRef<(() => void) | null>(null);

  const activeLanguage = useUserStore((state) => state.activeLanguage);
  const messages = useUserStore((state) => state.messages);
  const addMessage = useUserStore((state) => state.addMessage);
  const isListening = useUserStore((state) => state.isListening);
  const isSpeaking = useUserStore((state) => state.isSpeaking);
  const setIsSpeaking = useUserStore((state) => state.setIsSpeaking);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopPlayback();
      stopTimer();
      pipelineCleanupRef.current?.();
    };
  }, []);

  const startTimer = () => {
    setRecordingSeconds(0);
    timerRef.current = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopPlayback = () => {
    if (audioPlaybackRef.current) {
      audioPlaybackRef.current.pause();
      audioPlaybackRef.current = null;
    }
    setIsSpeaking(false);
  };

  const startRecording = async () => {
    stopPlayback();
    audioChunksRef.current.clear();
    
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
      const mediaRecorder = new MediaRecorder(filteredStream, { mimeType: 'audio/webm' });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current.toArray(), { type: 'audio/webm' });
        
        // Stop all original and filtered tracks cleanly to release hardware
        stream.getTracks().forEach(track => track.stop());
        filteredStream.getTracks().forEach(track => track.stop());
        
        // Clean up Web Audio nodes and context
        pipelineCleanupRef.current?.();
        pipelineCleanupRef.current = null;
        
        if (audioBlob.size > 1000) { // Only process if actual recording exists
          await processRecordedVoice(audioBlob);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      startTimer();
    } catch (error) {
      console.error('[USEVOICE] Microphone access failed:', error);
      alert('Microphone access is required to speak with Horizon.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      stopTimer();
    }
  };

  const speakText = (text: string): Promise<void> => {
    return new Promise(async (resolve) => {
      stopPlayback();
      setIsSpeaking(true);
      try {
        const audioUrl = await geminiService.generateSpeech(text, activeLanguage);
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
          setIsSpeaking(false);
          resolve();
        };
        
        audio.onerror = (e) => {
          console.error('[USEVOICE] HTML5 Audio playback/decode error:', audio.error || e);
          setIsSpeaking(false);
          resolve();
        };
        
        audioPlaybackRef.current = audio;
        await audio.play();
      } catch (error) {
        console.error('[USEVOICE] Speech generation failed:', error);
        setIsSpeaking(false);
        resolve();
      }
    });
  };

  const sendTextMessage = async (text: string, pageContext?: string) => {
    if (!text.trim()) return;
    
    setVoiceLoading(true);
    addMessage('user', text);
    
    try {
      // Use custom doubly-linked-list + hash-map LRU Cache to prune payload tokens in O(1) constant time
      const lru = new LRUChatCache(10);
      messages.forEach(msg => {
        lru.put(msg.role, msg.content);
      });
      const historyPayload = lru.getOrderedMessages();

      // Generate Gemini response
      const chatResult = await geminiService.generateResponse(
        text, 
        activeLanguage, 
        historyPayload,
        pageContext
      );
      
      const aiResponse = chatResult.response;
      addMessage('assistant', aiResponse);
      
      // Auto speak response in voice assistant drawer context
      const ttsEnabled = useUserStore.getState().ttsEnabled;
      if (isListening && ttsEnabled) {
        await speakText(aiResponse);
      }
    } catch (error) {
      console.error('[USEVOICE CHAT ERROR]', error);
      addMessage('assistant', 'Sorry anna, I had a connection hiccup. Let me try again!');
    } finally {
      setVoiceLoading(false);
    }
  };

  const processRecordedVoice = async (audioBlob: Blob) => {
    setVoiceLoading(true);
    try {
      // 1. Transcribe voice blob using Groq Whisper whisper-large-v3
      const sttResult = await groqService.transcribeAudio(audioBlob);
      const transcript = sttResult.transcript;
      
      if (!transcript.trim()) {
        addMessage('assistant', 'I could not hear anything. Can you say it again simply?');
        setVoiceLoading(false);
        return;
      }

      // 2. Forward transcript to Gemini Brain
      await sendTextMessage(transcript);
    } catch (error) {
      console.error('[USEVOICE PROCESS VOICE ERROR]', error);
      addMessage('assistant', 'Sorry anna, I could not understand the voice audio.');
    } finally {
      setVoiceLoading(false);
    }
  };

  return {
    isRecording,
    recordingSeconds,
    voiceLoading,
    isSpeaking,
    startRecording,
    stopRecording,
    speakText,
    sendTextMessage,
    stopPlayback
  };
}
