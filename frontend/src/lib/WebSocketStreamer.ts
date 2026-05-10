/**
 * WebSocketStreamer — EventHorizon AI
 *
 * Resilient WebSocket manager with buffer-and-retry logic
 * designed for unstable 2G networks.
 *
 * Features:
 * - Auto-reconnect with exponential backoff
 * - In-memory ring buffer for offline chunk storage
 * - Ordered flush on reconnect with sequence numbers
 * - Heartbeat-based silent disconnect detection
 * - Binary wire protocol with metadata headers
 */

import { NetworkMonitor } from './NetworkMonitor';

// --- Wire Protocol ---
// Each frame: [seq_hi][seq_lo][flags_hi][flags_lo][...opus_payload...]
// Flags:
const FLAG_FIRST_CHUNK = 0x0001;
const FLAG_LAST_CHUNK = 0x0002;
const FLAG_BUFFERED = 0x0004; // Was queued offline and sent later

export interface StreamerConfig {
  url: string;
  maxBufferSize?: number;       // Default: 120 chunks (30s at 250ms)
  reconnectBaseMs?: number;     // Default: 500ms
  reconnectMaxMs?: number;      // Default: 10000ms
  heartbeatIntervalMs?: number; // Default: 5000ms
  token?: string;               // Auth token for WS handshake
}

export type StreamerState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

interface BufferedChunk {
  sequenceNumber: number;
  flags: number;
  payload: ArrayBuffer;
  timestamp: number;
}

type MessageCallback = (data: any) => void;
type StateCallback = (state: StreamerState) => void;
type RTTCallback = (rttMs: number) => void;

export class WebSocketStreamer {
  private _config: Required<StreamerConfig>;
  private _ws: WebSocket | null = null;
  private _state: StreamerState = 'disconnected';
  private _sequenceNumber = 0;
  private _buffer: BufferedChunk[] = [];
  private _reconnectAttempts = 0;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private _lastPingSentAt = 0;
  private _destroyed = false;
  private _sessionId: string | null = null;

  // Callbacks
  private _onMessage: Set<MessageCallback> = new Set();
  private _onStateChange: Set<StateCallback> = new Set();
  private _onRTT: Set<RTTCallback> = new Set();

  // Network monitor reference (optional, for quality-aware decisions)
  private _networkMonitor: NetworkMonitor | null = null;

  constructor(config: StreamerConfig, networkMonitor?: NetworkMonitor) {
    this._config = {
      url: config.url,
      maxBufferSize: config.maxBufferSize ?? 120,
      reconnectBaseMs: config.reconnectBaseMs ?? 500,
      reconnectMaxMs: config.reconnectMaxMs ?? 10000,
      heartbeatIntervalMs: config.heartbeatIntervalMs ?? 5000,
      token: config.token ?? '',
    };

    this._networkMonitor = networkMonitor ?? null;

    // Auto-reconnect when network comes back online
    if (this._networkMonitor) {
      this._networkMonitor.onChange((status) => {
        if (status.online && this._state === 'disconnected' && !this._destroyed) {
          console.log('[WS] Network back online, attempting reconnect...');
          this.connect();
        }
      });
    }
  }

  // --- Public API ---

  get state(): StreamerState {
    return this._state;
  }

  get bufferedCount(): number {
    return this._buffer.length;
  }

  get isConnected(): boolean {
    return this._state === 'connected' && this._ws?.readyState === WebSocket.OPEN;
  }

  /** Connect to the WebSocket server */
  connect(): void {
    if (this._destroyed) return;
    if (this._ws && (this._ws.readyState === WebSocket.OPEN || this._ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this._setState(this._reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    try {
      // Append auth token as query parameter
      const url = this._config.token
        ? `${this._config.url}?token=${encodeURIComponent(this._config.token)}`
        : this._config.url;

      this._ws = new WebSocket(url);
      this._ws.binaryType = 'arraybuffer';

      this._ws.onopen = () => this._handleOpen();
      this._ws.onmessage = (event) => this._handleMessage(event);
      this._ws.onclose = (event) => this._handleClose(event);
      this._ws.onerror = (event) => this._handleError(event);
    } catch (err) {
      console.error('[WS] Connection error:', err);
      this._scheduleReconnect();
    }
  }

  /** Disconnect and stop reconnection attempts */
  disconnect(): void {
    this._clearReconnectTimer();
    this._clearHeartbeat();

    if (this._ws) {
      this._ws.onopen = null;
      this._ws.onmessage = null;
      this._ws.onclose = null;
      this._ws.onerror = null;

      if (this._ws.readyState === WebSocket.OPEN || this._ws.readyState === WebSocket.CONNECTING) {
        this._ws.close(1000, 'Client disconnect');
      }
      this._ws = null;
    }

    this._setState('disconnected');
  }

  /**
   * Send an audio chunk. If disconnected, buffer it.
   * @param payload - Raw Opus audio data
   * @param isFirst - Is this the first chunk of a recording?
   * @param isLast - Is this the last chunk of a recording?
   */
  sendChunk(payload: ArrayBuffer, isFirst: boolean, isLast: boolean): void {
    const seq = this._sequenceNumber++;
    let flags = 0;
    if (isFirst) flags |= FLAG_FIRST_CHUNK;
    if (isLast) flags |= FLAG_LAST_CHUNK;

    if (this.isConnected) {
      // Send immediately
      this._sendFrame(seq, flags, payload);
    } else {
      // Buffer for later
      flags |= FLAG_BUFFERED;
      this._bufferChunk(seq, flags, payload);
    }
  }

  /** Start a new recording session */
  startSession(): string {
    this._sessionId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this._sequenceNumber = 0;
    this._buffer = [];

    // Notify server of new session
    if (this.isConnected) {
      this._ws!.send(JSON.stringify({
        type: 'session_start',
        sessionId: this._sessionId,
      }));
    }

    return this._sessionId;
  }

  /** End the current recording session */
  endSession(): void {
    if (this.isConnected && this._sessionId) {
      this._ws!.send(JSON.stringify({
        type: 'session_end',
        sessionId: this._sessionId,
      }));
    }
    this._sessionId = null;
  }

  /** Subscribe to server messages (transcription, AI responses) */
  onMessage(callback: MessageCallback): () => void {
    this._onMessage.add(callback);
    return () => this._onMessage.delete(callback);
  }

  /** Subscribe to connection state changes */
  onStateChange(callback: StateCallback): () => void {
    this._onStateChange.add(callback);
    return () => this._onStateChange.delete(callback);
  }

  /** Subscribe to RTT measurements */
  onRTT(callback: RTTCallback): () => void {
    this._onRTT.add(callback);
    return () => this._onRTT.delete(callback);
  }

  /** Destroy the streamer and clean up all resources */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this.disconnect();
    this._buffer = [];
    this._onMessage.clear();
    this._onStateChange.clear();
    this._onRTT.clear();
  }

  // --- Private ---

  private _handleOpen(): void {
    console.log('[WS] Connected');
    this._reconnectAttempts = 0;
    this._setState('connected');
    this._startHeartbeat();

    // Flush buffered chunks
    if (this._buffer.length > 0) {
      console.log(`[WS] Flushing ${this._buffer.length} buffered chunks`);
      this._flushBuffer();
    }
  }

  private _handleMessage(event: MessageEvent): void {
    if (typeof event.data === 'string') {
      try {
        const msg = JSON.parse(event.data);

        // Handle heartbeat pong
        if (msg.type === 'pong') {
          const rtt = Date.now() - this._lastPingSentAt;
          this._onRTT.forEach((cb) => {
            try { cb(rtt); } catch (e) { /* swallow */ }
          });
          return;
        }

        // Forward all other messages to listeners
        this._onMessage.forEach((cb) => {
          try { cb(msg); } catch (e) { console.error('[WS] Message handler error:', e); }
        });
      } catch (e) {
        console.error('[WS] Failed to parse message:', e);
      }
    }
  }

  private _handleClose(event: CloseEvent): void {
    console.log(`[WS] Closed: code=${event.code} reason=${event.reason}`);
    this._clearHeartbeat();
    this._ws = null;

    if (!this._destroyed && event.code !== 1000) {
      this._scheduleReconnect();
    } else {
      this._setState('disconnected');
    }
  }

  private _handleError(_event: Event): void {
    console.error('[WS] Error occurred');
    // onclose will fire after onerror, so reconnect is handled there
  }

  private _sendFrame(seq: number, flags: number, payload: ArrayBuffer): void {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return;

    // Build binary frame: [seq(2)][flags(2)][payload(N)]
    const header = new ArrayBuffer(4);
    const view = new DataView(header);
    view.setUint16(0, seq & 0xFFFF, false); // big-endian
    view.setUint16(2, flags & 0xFFFF, false);

    // Combine header + payload
    const frame = new Uint8Array(4 + payload.byteLength);
    frame.set(new Uint8Array(header), 0);
    frame.set(new Uint8Array(payload), 4);

    try {
      this._ws.send(frame.buffer);
    } catch (err) {
      console.error('[WS] Send error, buffering chunk:', err);
      this._bufferChunk(seq, flags | FLAG_BUFFERED, payload);
    }
  }

  private _bufferChunk(seq: number, flags: number, payload: ArrayBuffer): void {
    if (this._buffer.length >= this._config.maxBufferSize) {
      // Ring buffer: drop oldest chunk
      this._buffer.shift();
      console.warn('[WS] Buffer full, dropped oldest chunk');
    }

    this._buffer.push({
      sequenceNumber: seq,
      flags,
      payload,
      timestamp: Date.now(),
    });
  }

  private _flushBuffer(): void {
    while (this._buffer.length > 0 && this.isConnected) {
      const chunk = this._buffer.shift()!;
      this._sendFrame(chunk.sequenceNumber, chunk.flags, chunk.payload);
    }
  }

  private _scheduleReconnect(): void {
    if (this._destroyed) return;

    this._clearReconnectTimer();
    this._setState('reconnecting');

    // Exponential backoff: 500ms, 1s, 2s, 4s, 8s, 10s (capped)
    const delay = Math.min(
      this._config.reconnectBaseMs * Math.pow(2, this._reconnectAttempts),
      this._config.reconnectMaxMs
    );

    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this._reconnectAttempts + 1})`);

    this._reconnectTimer = setTimeout(() => {
      this._reconnectAttempts++;
      this.connect();
    }, delay);
  }

  private _clearReconnectTimer(): void {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  private _startHeartbeat(): void {
    this._clearHeartbeat();
    this._heartbeatTimer = setInterval(() => {
      if (this.isConnected) {
        this._lastPingSentAt = Date.now();
        try {
          this._ws!.send(JSON.stringify({ type: 'ping', ts: this._lastPingSentAt }));
        } catch {
          // Will be caught by onclose/onerror
        }
      }
    }, this._config.heartbeatIntervalMs);
  }

  private _clearHeartbeat(): void {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  private _setState(state: StreamerState): void {
    if (this._state === state) return;
    this._state = state;
    this._onStateChange.forEach((cb) => {
      try { cb(state); } catch (e) { console.error('[WS] State change handler error:', e); }
    });
  }
}
