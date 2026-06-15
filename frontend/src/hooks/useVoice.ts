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

// Construct base WS URL from configuration
let API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
if (API_URL.startsWith("http://") && !API_URL.includes("localhost") && !API_URL.includes("127.0.0.1")) {
  API_URL = API_URL.replace("http://", "https://");
}
const WS_URL = API_URL.replace(/^http/, 'ws') + '/api/assistant/ws';

export function useVoice() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceLoading, setVoiceLoading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<CircularBlobBuffer>(new CircularBlobBuffer(500));
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const rawQueueRef = useRef<string[]>([]);
  const isProcessingQueueRef = useRef<boolean>(false);
  const pipelineCleanupRef = useRef<(() => void) | null>(null);

  // Sequence-based ordered playback for parallel TTS workers
  const pendingAudioChunksRef = useRef<Map<number, string>>(new Map());
  const nextExpectedSeqRef = useRef<number>(0);

  const activeLanguage = useUserStore((state) => state.activeLanguage);
  const messages = useUserStore((state) => state.messages);
  const addMessage = useUserStore((state) => state.addMessage);
  const appendMessageChunk = useUserStore((state) => state.appendMessageChunk);
  const updateMessage = useUserStore((state) => state.updateMessage);
  const isListening = useUserStore((state) => state.isListening);
  const isSpeaking = useUserStore((state) => state.isSpeaking);
  const setIsSpeaking = useUserStore((state) => state.setIsSpeaking);

  const socketRef = useRef<WebSocket | null>(null);
  const activeLanguageRef = useRef(activeLanguage);

  // Keep active language ref updated for WS callbacks
  useEffect(() => {
    activeLanguageRef.current = activeLanguage;
  }, [activeLanguage]);

  const disconnectWebSocket = () => {
    if (socketRef.current) {
      console.log('[WebSocket] Closing existing connection.');
      socketRef.current.close();
      socketRef.current = null;
    }
  };

  const getAudioContext = (): AudioContext => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioContextClass();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch((err) => console.warn('[USEVOICE] Could not resume AudioContext:', err));
    }
    return audioCtxRef.current;
  };

  const decodeBase64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const scheduleAudioBuffer = (audioBuffer: AudioBuffer) => {
    const audioCtx = getAudioContext();
    const now = audioCtx.currentTime;
    
    let startTime = nextPlayTimeRef.current;
    if (startTime < now) {
      startTime = now + 0.05; // 50ms safety buffer
    }
    
    const sourceNode = audioCtx.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.connect(audioCtx.destination);
    
    activeSourcesRef.current.push(sourceNode);
    setIsSpeaking(true);
    
    sourceNode.start(startTime);
    nextPlayTimeRef.current = startTime + audioBuffer.duration;
    
    sourceNode.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter(src => src !== sourceNode);
      if (activeSourcesRef.current.length === 0 && rawQueueRef.current.length === 0) {
        setIsSpeaking(false);
      }
    };
  };

  const processAudioQueue = async () => {
    if (isProcessingQueueRef.current) return;
    isProcessingQueueRef.current = true;

    while (rawQueueRef.current.length > 0) {
      const nextAudioB64 = rawQueueRef.current.shift()!;
      try {
        const arrayBuffer = decodeBase64ToArrayBuffer(nextAudioB64);
        const audioCtx = getAudioContext();
        
        // decodeAudioData consumes the arrayBuffer
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        scheduleAudioBuffer(audioBuffer);
      } catch (error) {
        console.error('[USEVOICE] Decode queue audio chunk failed:', error);
      }
    }

    isProcessingQueueRef.current = false;
  };

  const connectWebSocket = () => {
    disconnectWebSocket();

    const token = useUserStore.getState().token || '';
    let wsUrl = WS_URL;
    if (token) {
      wsUrl += `?token=${encodeURIComponent(token)}`;
    }

    console.log('[WebSocket] Connecting to:', wsUrl);
    const ws = new WebSocket(wsUrl);
    let currentStreamingMsgId: string | null = null;

    ws.onopen = () => {
      console.log('[WebSocket] Connection established.');
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[WebSocket] Msg type received:', data.type);

        switch (data.type) {
          case 'stream_start':
            setVoiceLoading(false);
            // Clear any old queue and stop playback
            stopPlayback();
            // Reset sequence state for new stream
            pendingAudioChunksRef.current.clear();
            nextExpectedSeqRef.current = 0;
            
            const newMsgId = Math.random().toString(36).substring(2, 9);
            currentStreamingMsgId = newMsgId;
            
            useUserStore.setState((state) => {
              const placeholderMsg = {
                id: newMsgId,
                role: 'assistant' as const,
                content: '',
                timestamp: new Date()
              };
              return { messages: [...state.messages, placeholderMsg] };
            });
            break;

          case 'text_chunk':
            if (currentStreamingMsgId) {
              appendMessageChunk(currentStreamingMsgId, data.text);
            }
            break;

          case 'text_complete':
            if (currentStreamingMsgId) {
              updateMessage(currentStreamingMsgId, { content: data.text });
            }
            // Flush any remaining buffered audio chunks (safety: handles lost seq gaps)
            pendingAudioChunksRef.current.forEach((audio) => {
              if (audio) {
                rawQueueRef.current.push(audio);
              }
            });
            pendingAudioChunksRef.current.clear();
            processAudioQueue();
            break;

          case 'transcript_chunk':
            setVoiceLoading(false);
            useUserStore.setState((state) => {
              const index = state.messages.findIndex(m => m.id === 'user_transcript_temp');
              if (index === -1) {
                const newMsg = {
                  id: 'user_transcript_temp',
                  role: 'user' as const,
                  content: data.text,
                  timestamp: new Date()
                };
                return { messages: [...state.messages, newMsg] };
              } else {
                return {
                  messages: state.messages.map(m => 
                    m.id === 'user_transcript_temp' ? { ...m, content: data.text } : m
                  )
                };
              }
            });
            break;

          case 'transcript':
            setVoiceLoading(false);
            useUserStore.setState((state) => {
              const exists = state.messages.some(m => m.id === 'user_transcript_temp');
              if (exists) {
                return {
                  messages: state.messages.map(m => 
                    m.id === 'user_transcript_temp' ? { ...m, id: Math.random().toString(36).substring(2, 9), content: data.text } : m
                  )
                };
              } else {
                const newMsg = {
                  id: Math.random().toString(36).substring(2, 9),
                  role: 'user' as const,
                  content: data.text,
                  timestamp: new Date()
                };
                return { messages: [...state.messages, newMsg] };
              }
            });
            break;

          case 'audio_chunk':
            if (data.seq !== undefined) {
              // Buffer chunk and flush in-order (handles out-of-order arrival from parallel workers)
              if (data.audio) {
                pendingAudioChunksRef.current.set(data.seq, data.audio);
              } else {
                // TTS failed for this chunk — mark as processed with empty string
                pendingAudioChunksRef.current.set(data.seq, '');
              }
              // Flush all consecutive in-order chunks
              while (pendingAudioChunksRef.current.has(nextExpectedSeqRef.current)) {
                const audio = pendingAudioChunksRef.current.get(nextExpectedSeqRef.current)!;
                pendingAudioChunksRef.current.delete(nextExpectedSeqRef.current);
                nextExpectedSeqRef.current++;
                if (audio) { // Only queue non-empty audio for playback
                  rawQueueRef.current.push(audio);
                }
              }
              processAudioQueue();
            } else {
              // Backward compat: no sequence number, play immediately
              rawQueueRef.current.push(data.audio);
              processAudioQueue();
            }
            break;

          case 'audio':
            await playBase64Audio(data.audio);
            break;

          case 'error':
            setVoiceLoading(false);
            addMessage('assistant', data.message || 'Error occurred.');
            break;
        }
      } catch (err) {
        console.error('[WebSocket] Parsing message error:', err);
      }
    };

    ws.onclose = (e) => {
      console.log('[WebSocket] Connection closed:', e.reason);
      setTimeout(() => {
        if (useUserStore.getState().isListening) {
          connectWebSocket();
        }
      }, 3000);
    };

    ws.onerror = (err) => {
      console.error('[WebSocket] Connection error:', err);
    };

    socketRef.current = ws;
  };

  const playBase64Audio = (base64Wav: string): Promise<void> => {
    return new Promise(async (resolve) => {
      stopPlayback();
      try {
        const arrayBuffer = decodeBase64ToArrayBuffer(base64Wav);
        const audioCtx = getAudioContext();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        
        const sourceNode = audioCtx.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.connect(audioCtx.destination);
        
        activeSourcesRef.current.push(sourceNode);
        setIsSpeaking(true);
        
        sourceNode.onended = () => {
          activeSourcesRef.current = activeSourcesRef.current.filter(src => src !== sourceNode);
          setIsSpeaking(false);
          resolve();
        };
        
        sourceNode.start(0);
      } catch (error) {
        console.error('[USEVOICE] Play base64 audio failed:', error);
        setIsSpeaking(false);
        resolve();
      }
    });
  };

  const sendAudioChunkToSocket = (chunk: Blob) => {
    if (chunk.size > 0 && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const reader = new FileReader();
      reader.readAsDataURL(chunk);
      reader.onloadend = () => {
        const base64Data = reader.result as string;
        const base64Content = base64Data.split(',')[1];
        
        const payload = {
          type: 'audio_chunk',
          audio: base64Content,
          language: activeLanguage
        };
        
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify(payload));
        }
      };
    }
  };

  // Connect WebSocket when drawer is active
  useEffect(() => {
    if (isListening) {
      getAudioContext(); // Pre-warm AudioContext for instant first playback
      connectWebSocket();
    } else {
      disconnectWebSocket();
    }
    return () => {
      disconnectWebSocket();
    };
  }, [isListening]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopPlayback();
      stopTimer();
      pipelineCleanupRef.current?.();
      disconnectWebSocket();
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
    rawQueueRef.current = [];
    isProcessingQueueRef.current = false;
    // Clear parallel TTS sequence state
    pendingAudioChunksRef.current.clear();
    nextExpectedSeqRef.current = 0;
    if (activeSourcesRef.current.length > 0) {
      activeSourcesRef.current.forEach((source) => {
        try {
          source.stop();
        } catch (e) {
          // ignore
        }
      });
      activeSourcesRef.current = [];
    }
    nextPlayTimeRef.current = 0;
    setIsSpeaking(false);
  };

  const startRecording = async () => {
    stopPlayback();
    audioChunksRef.current.clear();
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        }
      });
      
      const { filteredStream, cleanup } = createNoiseReductionPipeline(stream);
      pipelineCleanupRef.current = cleanup;

      const mediaRecorder = new MediaRecorder(filteredStream, { mimeType: 'audio/webm' });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          // Send ONLY the new raw audio chunk non-cumulatively to the socket
          sendAudioChunkToSocket(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current.toArray(), { type: 'audio/webm' });
        
        stream.getTracks().forEach(track => track.stop());
        filteredStream.getTracks().forEach(track => track.stop());
        
        pipelineCleanupRef.current?.();
        pipelineCleanupRef.current = null;
        
        if (audioBlob.size > 1000) {
          await processRecordedVoice(audioBlob);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // slice audio and trigger dataavailable every 1.0 second
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
      try {
        const audioUrl = await geminiService.generateSpeech(text, activeLanguage);
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        
        const audioCtx = getAudioContext();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        
        const sourceNode = audioCtx.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.connect(audioCtx.destination);
        
        activeSourcesRef.current.push(sourceNode);
        setIsSpeaking(true);
        
        sourceNode.onended = () => {
          activeSourcesRef.current = activeSourcesRef.current.filter(src => src !== sourceNode);
          setIsSpeaking(false);
          resolve();
        };
        
        sourceNode.start(0);
      } catch (error) {
        console.error('[USEVOICE] Speech generation failed:', error);
        setIsSpeaking(false);
        resolve();
      }
    });
  };

  const sendTextMessage = async (text: string, pageContext?: string) => {
    if (!text.trim()) return;
    
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      addMessage('user', text);
      setVoiceLoading(true);
      
      const lru = new LRUChatCache(10);
      messages.forEach(msg => {
        lru.put(msg.role, msg.content);
      });
      const historyPayload = lru.getOrderedMessages();
      
      const payload = {
        type: 'text',
        message: text,
        language: activeLanguage,
        history: historyPayload,
        page_context: pageContext || 'general',
        tts_enabled: useUserStore.getState().ttsEnabled
      };
      socketRef.current.send(JSON.stringify(payload));
      return;
    }

    setVoiceLoading(true);
    addMessage('user', text);
    
    try {
      const lru = new LRUChatCache(10);
      messages.forEach(msg => {
        lru.put(msg.role, msg.content);
      });
      const historyPayload = lru.getOrderedMessages();

      const chatResult = await geminiService.generateResponse(
        text, 
        activeLanguage, 
        historyPayload,
        pageContext
      );
      
      const aiResponse = chatResult.response;
      addMessage('assistant', aiResponse);
      
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
    
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const lru = new LRUChatCache(10);
      messages.forEach(msg => {
        lru.put(msg.role, msg.content);
      });
      const historyPayload = lru.getOrderedMessages();
      
      const payload = {
        type: 'audio_end',
        audio: "", // Server accumulates chunks dynamically, so no need to send the full audio blob here
        language: activeLanguage,
        history: historyPayload,
        page_context: 'general',
        tts_enabled: useUserStore.getState().ttsEnabled
      };
      
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify(payload));
      }
      return;
    }

    try {
      const sttResult = await groqService.transcribeAudio(audioBlob);
      const transcript = sttResult.transcript;
      
      if (!transcript.trim()) {
        addMessage('assistant', 'I could not hear anything. Can you say it again simply?');
        setVoiceLoading(false);
        return;
      }

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
