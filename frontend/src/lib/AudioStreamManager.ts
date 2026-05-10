/**
 * AudioStreamManager — EventHorizon AI
 *
 * Central orchestrator for the audio capture pipeline.
 * Handles microphone acquisition, MediaRecorder-based Opus encoding,
 * chunk emission, AudioWorklet waveform extraction, and the
 * 30-second recording duration limit.
 *
 * Architecture:
 *   Microphone → AudioContext → AudioWorkletNode (PCM → waveform)
 *                             → MediaRecorder (Opus @ 12kbps → chunks)
 */

// --- Configuration ---
const OPUS_MIME_TYPE = 'audio/webm;codecs=opus';
const FALLBACK_MIME_TYPE = 'audio/webm';

const RECORDER_BITRATE = 12_000; // 12kbps — sweet spot for voice on 2G

const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
  // sampleRate is a hint, not all browsers honor it
  sampleRate: 16000,
};

const CHUNK_INTERVAL_MS = 250; // Emit chunk every 250ms
const MAX_RECORDING_DURATION_MS = 30_000; // 30 second hard limit

export type AudioChunk = {
  data: Blob;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  timestamp: number;
};

type ChunkCallback = (chunk: AudioChunk) => void;
type WaveformCallback = (level: number, peak: number) => void;
type StateCallback = (state: 'idle' | 'preparing' | 'recording' | 'stopping') => void;
type ErrorCallback = (error: Error) => void;

export class AudioStreamManager {
  private _state: 'idle' | 'preparing' | 'recording' | 'stopping' = 'idle';
  private _stream: MediaStream | null = null;
  private _mediaRecorder: MediaRecorder | null = null;
  private _audioContext: AudioContext | null = null;
  private _workletNode: AudioWorkletNode | null = null;
  private _sourceNode: MediaStreamAudioSourceNode | null = null;
  private _chunkIndex = 0;
  private _durationTimer: ReturnType<typeof setTimeout> | null = null;
  private _destroyed = false;

  // Callbacks
  private _onChunk: Set<ChunkCallback> = new Set();
  private _onWaveform: Set<WaveformCallback> = new Set();
  private _onStateChange: Set<StateCallback> = new Set();
  private _onError: Set<ErrorCallback> = new Set();

  // Smoothed waveform level for UI
  private _currentLevel = 0;
  private _currentPeak = 0;

  // VAD (Voice Activity Detection)
  private _hasSpoken = false;
  private _silenceStartMs = 0;
  private readonly SILENCE_THRESHOLD = 0.05;
  private readonly SILENCE_DURATION_MS = 3000;

  // --- Public API ---

  get state() {
    return this._state;
  }

  get isRecording() {
    return this._state === 'recording';
  }

  get waveformLevel() {
    return this._currentLevel;
  }

  get waveformPeak() {
    return this._currentPeak;
  }

  /**
   * Check if the browser supports Opus encoding via MediaRecorder
   */
  static isOpusSupported(): boolean {
    if (typeof MediaRecorder === 'undefined') return false;
    return MediaRecorder.isTypeSupported(OPUS_MIME_TYPE);
  }

  /**
   * Start capturing audio from the microphone.
   * Chunks are emitted via onChunk callback every 250ms.
   */
  async start(): Promise<void> {
    if (this._destroyed) throw new Error('AudioStreamManager is destroyed');
    if (this._state !== 'idle') {
      console.warn('[AudioStream] Already recording or preparing');
      return;
    }

    this._setState('preparing');
    this._chunkIndex = 0;
    this._hasSpoken = false;
    this._silenceStartMs = 0;

    try {
      // 1. Acquire microphone
      this._stream = await navigator.mediaDevices.getUserMedia({
        audio: AUDIO_CONSTRAINTS,
      });

      // 2. Set up AudioContext + Worklet for waveform
      await this._setupAudioWorklet();

      // 3. Set up MediaRecorder for Opus encoding
      this._setupMediaRecorder();

      // 4. Start recording
      this._mediaRecorder!.start(CHUNK_INTERVAL_MS);
      this._setState('recording');

      // 5. Set 30-second auto-stop timer
      this._durationTimer = setTimeout(() => {
        console.log('[AudioStream] 30s limit reached, auto-stopping');
        this.stop();
      }, MAX_RECORDING_DURATION_MS);

      // Haptic feedback on mobile
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }

      console.log('[AudioStream] Recording started (Opus @ 12kbps, 250ms chunks)');
    } catch (err) {
      this._cleanup();
      this._setState('idle');
      const error = err instanceof Error ? err : new Error(String(err));
      this._emitError(error);
      throw error;
    }
  }

  /**
   * Stop recording and emit the final chunk.
   */
  stop(): void {
    if (this._state !== 'recording' && this._state !== 'preparing') {
      return;
    }

    this._setState('stopping');

    // Clear duration timer
    if (this._durationTimer) {
      clearTimeout(this._durationTimer);
      this._durationTimer = null;
    }

    // Stop MediaRecorder (will trigger one last ondataavailable + onstop)
    if (this._mediaRecorder && this._mediaRecorder.state !== 'inactive') {
      this._mediaRecorder.stop();
    } else {
      // If MediaRecorder wasn't started, just cleanup
      this._cleanup();
      this._setState('idle');
    }

    // Haptic feedback on mobile
    if (navigator.vibrate) {
      navigator.vibrate([30, 50, 30]);
    }
  }

  /**
   * Destroy the manager and release all resources.
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this.stop();
    this._cleanup();
    this._onChunk.clear();
    this._onWaveform.clear();
    this._onStateChange.clear();
    this._onError.clear();
  }

  // --- Callback subscriptions ---

  onChunk(callback: ChunkCallback): () => void {
    this._onChunk.add(callback);
    return () => this._onChunk.delete(callback);
  }

  onWaveform(callback: WaveformCallback): () => void {
    this._onWaveform.add(callback);
    return () => this._onWaveform.delete(callback);
  }

  onStateChange(callback: StateCallback): () => void {
    this._onStateChange.add(callback);
    return () => this._onStateChange.delete(callback);
  }

  onError(callback: ErrorCallback): () => void {
    this._onError.add(callback);
    return () => this._onError.delete(callback);
  }

  // --- Private ---

  private async _setupAudioWorklet(): Promise<void> {
    try {
      this._audioContext = new AudioContext({ sampleRate: 16000 });

      // Load the worklet processor
      await this._audioContext.audioWorklet.addModule('/pcm-worklet.js');

      // Create source from microphone stream
      this._sourceNode = this._audioContext.createMediaStreamSource(this._stream!);

      // Create worklet node
      this._workletNode = new AudioWorkletNode(this._audioContext, 'pcm-processor');

      // Listen for waveform data from the worklet
      this._workletNode.port.onmessage = (event) => {
        const { rms, peak } = event.data;

        // Smooth the levels for UI (exponential moving average)
        this._currentLevel = this._currentLevel * 0.3 + rms * 0.7;
        this._currentPeak = this._currentPeak * 0.2 + peak * 0.8;

        // VAD (Silence Detection)
        if (this._currentLevel > this.SILENCE_THRESHOLD) {
          this._hasSpoken = true;
          this._silenceStartMs = 0; // Reset silence timer when speaking
        } else if (this._hasSpoken && this._state === 'recording') {
          if (this._silenceStartMs === 0) {
            this._silenceStartMs = Date.now();
          } else if (Date.now() - this._silenceStartMs > this.SILENCE_DURATION_MS) {
            console.log(`[AudioStream] ${this.SILENCE_DURATION_MS}ms silence detected, auto-stopping mic`);
            this.stop();
          }
        }

        this._onWaveform.forEach((cb) => {
          try { cb(this._currentLevel, this._currentPeak); } catch (e) { /* swallow */ }
        });
      };

      // Connect: mic → worklet (worklet doesn't need to connect to destination)
      this._sourceNode.connect(this._workletNode);
      // Connect worklet to destination to keep the graph alive
      // (use a gain node set to 0 to prevent feedback)
      const silentGain = this._audioContext.createGain();
      silentGain.gain.value = 0;
      this._workletNode.connect(silentGain);
      silentGain.connect(this._audioContext.destination);

    } catch (err) {
      // AudioWorklet not supported — waveform won't work but recording still will
      console.warn('[AudioStream] AudioWorklet not available, waveform disabled:', err);
    }
  }

  private _setupMediaRecorder(): void {
    // Determine best MIME type
    const mimeType = MediaRecorder.isTypeSupported(OPUS_MIME_TYPE)
      ? OPUS_MIME_TYPE
      : MediaRecorder.isTypeSupported(FALLBACK_MIME_TYPE)
        ? FALLBACK_MIME_TYPE
        : '';

    const options: MediaRecorderOptions = {
      audioBitsPerSecond: RECORDER_BITRATE,
    };

    if (mimeType) {
      options.mimeType = mimeType;
    }

    console.log(`[AudioStream] Using MIME: ${mimeType || 'browser default'} @ ${RECORDER_BITRATE}bps`);

    this._mediaRecorder = new MediaRecorder(this._stream!, options);

    // Handle each chunk as it arrives
    this._mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        const chunk: AudioChunk = {
          data: event.data,
          index: this._chunkIndex,
          isFirst: this._chunkIndex === 0,
          isLast: false, // Will be set true on the final chunk in onstop
          timestamp: Date.now(),
        };
        this._chunkIndex++;

        this._onChunk.forEach((cb) => {
          try { cb(chunk); } catch (e) { console.error('[AudioStream] Chunk handler error:', e); }
        });
      }
    };

    // Handle recording stop
    this._mediaRecorder.onstop = () => {
      // Emit a sentinel "last" event so consumers know the stream is complete
      const lastChunk: AudioChunk = {
        data: new Blob([], { type: mimeType || 'audio/webm' }),
        index: this._chunkIndex,
        isFirst: false,
        isLast: true,
        timestamp: Date.now(),
      };

      this._onChunk.forEach((cb) => {
        try { cb(lastChunk); } catch (e) { /* swallow */ }
      });

      this._cleanup();
      this._setState('idle');
      console.log(`[AudioStream] Recording stopped. Total chunks: ${this._chunkIndex}`);
    };

    this._mediaRecorder.onerror = (event: Event) => {
      console.error('[AudioStream] MediaRecorder error:', event);
      this._emitError(new Error('MediaRecorder error'));
      this.stop();
    };
  }

  private _cleanup(): void {
    // Stop all tracks
    if (this._stream) {
      this._stream.getTracks().forEach((track) => track.stop());
      this._stream = null;
    }

    // Disconnect worklet
    if (this._workletNode) {
      this._workletNode.port.onmessage = null;
      this._workletNode.disconnect();
      this._workletNode = null;
    }

    if (this._sourceNode) {
      this._sourceNode.disconnect();
      this._sourceNode = null;
    }

    // Close audio context
    if (this._audioContext && this._audioContext.state !== 'closed') {
      this._audioContext.close().catch(() => { /* swallow */ });
      this._audioContext = null;
    }

    // Clear duration timer
    if (this._durationTimer) {
      clearTimeout(this._durationTimer);
      this._durationTimer = null;
    }

    // Reset waveform and VAD
    this._currentLevel = 0;
    this._currentPeak = 0;
    this._hasSpoken = false;
    this._silenceStartMs = 0;

    this._mediaRecorder = null;
  }

  private _setState(state: typeof this._state): void {
    if (this._state === state) return;
    this._state = state;
    this._onStateChange.forEach((cb) => {
      try { cb(state); } catch (e) { /* swallow */ }
    });
  }

  private _emitError(error: Error): void {
    this._onError.forEach((cb) => {
      try { cb(error); } catch (e) { /* swallow */ }
    });
  }
}
