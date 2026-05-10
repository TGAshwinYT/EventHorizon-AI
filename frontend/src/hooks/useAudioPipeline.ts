/**
 * useAudioPipeline — EventHorizon AI
 *
 * React hook that orchestrates the full audio pipeline:
 * AudioStreamManager → WebSocketStreamer (with fallback to FormData POST)
 *
 * Provides reactive state for UI components and manages
 * resource lifecycle with proper cleanup on unmount.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { AudioStreamManager } from '../lib/AudioStreamManager';
import { WebSocketStreamer, type StreamerState } from '../lib/WebSocketStreamer';
import { NetworkMonitor, type NetworkQuality } from '../lib/NetworkMonitor';

// --- Types ---

export interface AudioPipelineConfig {
  wsUrl?: string;       // WebSocket URL, default: auto-detect
  token?: string;       // Auth token
  useFallback?: boolean; // Force FormData fallback (when no WS backend)
}

export type PipelineStreamState = 'idle' | 'streaming' | 'buffering' | 'flushing';

export interface UseAudioPipelineReturn {
  // State
  isRecording: boolean;
  isConnected: boolean;
  networkQuality: NetworkQuality;
  waveformLevel: number;
  bufferedChunks: number;
  streamState: PipelineStreamState;
  recordingDuration: number; // seconds

  // Actions
  startRecording: () => Promise<void>;
  stopRecording: () => void;

  // Fallback: get recorded blob for FormData upload
  getRecordedBlob: () => Blob | null;
}

/**
 * Determine WebSocket URL from current page location
 */
function getDefaultWsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/audio`;
}

export function useAudioPipeline(config: AudioPipelineConfig = {}): UseAudioPipelineReturn {
  // --- Refs for class instances (persist across renders) ---
  const audioManagerRef = useRef<AudioStreamManager | null>(null);
  const wsStreamerRef = useRef<WebSocketStreamer | null>(null);
  const networkMonitorRef = useRef<NetworkMonitor | null>(null);
  const allChunksRef = useRef<Blob[]>([]);   // For fallback mode
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Reactive state ---
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>('good');
  const [waveformLevel, setWaveformLevel] = useState(0);
  const [bufferedChunks, setBufferedChunks] = useState(0);
  const [streamState, setStreamState] = useState<PipelineStreamState>('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  const useFallback = config.useFallback ?? true; // Default to fallback until WS backend is ready

  // --- Initialize network monitor ---
  useEffect(() => {
    const monitor = new NetworkMonitor();
    networkMonitorRef.current = monitor;

    monitor.onChange((status) => {
      setNetworkQuality(status.quality);
    });

    setNetworkQuality(monitor.quality);

    return () => {
      monitor.destroy();
      networkMonitorRef.current = null;
    };
  }, []);

  // --- Initialize WebSocket streamer (only if not in fallback mode) ---
  useEffect(() => {
    if (useFallback) {
      setIsConnected(false);
      return;
    }

    const wsUrl = config.wsUrl || getDefaultWsUrl();
    const streamer = new WebSocketStreamer(
      {
        url: wsUrl,
        token: config.token,
        maxBufferSize: 120,
        reconnectBaseMs: 500,
        reconnectMaxMs: 10000,
        heartbeatIntervalMs: 5000,
      },
      networkMonitorRef.current ?? undefined
    );

    wsStreamerRef.current = streamer;

    // Track connection state
    streamer.onStateChange((state: StreamerState) => {
      setIsConnected(state === 'connected');

      switch (state) {
        case 'connected':
          setStreamState((prev) => (prev === 'buffering' || prev === 'flushing') ? 'flushing' : prev);
          break;
        case 'reconnecting':
          if (isRecording) setStreamState('buffering');
          break;
        case 'disconnected':
          if (isRecording) setStreamState('buffering');
          break;
      }
    });

    // Track RTT for network quality estimation
    streamer.onRTT((rttMs: number) => {
      networkMonitorRef.current?.updateRTT(rttMs);
    });

    // Attempt initial connection
    streamer.connect();

    return () => {
      streamer.destroy();
      wsStreamerRef.current = null;
    };
  }, [useFallback, config.wsUrl, config.token]);

  // --- Start recording ---
  const startRecording = useCallback(async () => {
    if (isRecording) return;

    // Reset state
    allChunksRef.current = [];
    setRecordedBlob(null);
    setBufferedChunks(0);
    setRecordingDuration(0);

    // Create audio manager
    const audioManager = new AudioStreamManager();
    audioManagerRef.current = audioManager;

    // Wire up waveform updates
    audioManager.onWaveform((level, _peak) => {
      setWaveformLevel(level);
    });

    // Wire up chunk handling
    audioManager.onChunk((chunk) => {
      // Always collect chunks for fallback blob
      if (chunk.data.size > 0) {
        allChunksRef.current.push(chunk.data);
      }

      if (!useFallback && wsStreamerRef.current) {
        // Stream via WebSocket
        if (chunk.data.size > 0) {
          chunk.data.arrayBuffer().then((buffer) => {
            wsStreamerRef.current?.sendChunk(buffer, chunk.isFirst, chunk.isLast);
            setBufferedChunks(wsStreamerRef.current?.bufferedCount ?? 0);
          });
        }

        if (chunk.isLast) {
          wsStreamerRef.current?.endSession();
          setStreamState('idle');
        }
      }

      if (chunk.isLast) {
        // Create combined blob for fallback
        if (allChunksRef.current.length > 0) {
          const combinedBlob = new Blob(allChunksRef.current, {
            type: AudioStreamManager.isOpusSupported() ? 'audio/webm;codecs=opus' : 'audio/webm'
          });
          setRecordedBlob(combinedBlob);
        }
      }
    });

    // Wire up state changes
    audioManager.onStateChange((state) => {
      const recording = state === 'recording';
      setIsRecording(recording);

      if (recording && !useFallback) {
        wsStreamerRef.current?.startSession();
        setStreamState('streaming');
      }

      if (state === 'idle') {
        setWaveformLevel(0);
        setStreamState('idle');

        // Clear duration timer
        if (durationTimerRef.current) {
          clearInterval(durationTimerRef.current);
          durationTimerRef.current = null;
        }
      }
    });

    // Wire up errors
    audioManager.onError((error) => {
      console.error('[Pipeline] Audio error:', error);
      setIsRecording(false);
      setStreamState('idle');
      setWaveformLevel(0);

      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    });

    // Start the audio capture
    try {
      await audioManager.start();

      // Start duration counter
      const startTime = Date.now();
      durationTimerRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 200);
    } catch (err) {
      console.error('[Pipeline] Failed to start recording:', err);
      audioManagerRef.current = null;
    }
  }, [isRecording, useFallback]);

  // --- Stop recording ---
  const stopRecording = useCallback(() => {
    if (audioManagerRef.current) {
      audioManagerRef.current.stop();
      // Manager will be cleaned up in its onstop handler
      audioManagerRef.current = null;
    }

    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);

  // --- Get recorded blob (for fallback FormData upload) ---
  const getRecordedBlob = useCallback((): Blob | null => {
    if (allChunksRef.current.length > 0) {
      return new Blob(allChunksRef.current, {
        type: AudioStreamManager.isOpusSupported() ? 'audio/webm;codecs=opus' : 'audio/webm'
      });
    }
    return recordedBlob;
  }, [recordedBlob]);

  // --- Cleanup on unmount ---
  useEffect(() => {
    return () => {
      if (audioManagerRef.current) {
        audioManagerRef.current.destroy();
        audioManagerRef.current = null;
      }
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    };
  }, []);

  return {
    isRecording,
    isConnected,
    networkQuality,
    waveformLevel,
    bufferedChunks,
    streamState,
    recordingDuration,
    startRecording,
    stopRecording,
    getRecordedBlob,
  };
}
