/**
 * NetworkMonitor — EventHorizon AI
 *
 * Lightweight observer for network connectivity and quality estimation.
 * Designed for rural 2G environments where connections are unreliable.
 *
 * Uses:
 * - navigator.onLine for basic online/offline
 * - Network Information API (where available) for connection type
 * - WebSocket heartbeat RTT for real-time quality estimation
 */

export type NetworkQuality = 'offline' | '2g' | '3g' | 'good';

export type NetworkStatus = {
  online: boolean;
  quality: NetworkQuality;
  rttMs: number | null;
  downlinkMbps: number | null;
  effectiveType: string | null;
};

type NetworkEventCallback = (status: NetworkStatus) => void;

// Extend Navigator for Network Information API (not in all TS libs)
interface NetworkInformation extends EventTarget {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  addEventListener(type: 'change', listener: () => void): void;
  removeEventListener(type: 'change', listener: () => void): void;
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformation;
  mozConnection?: NetworkInformation;
  webkitConnection?: NetworkInformation;
}

export class NetworkMonitor {
  private _status: NetworkStatus;
  private _listeners: Set<NetworkEventCallback> = new Set();
  private _connection: NetworkInformation | undefined;
  private _boundOnOnline: () => void;
  private _boundOnOffline: () => void;
  private _boundOnConnectionChange: () => void;
  private _destroyed = false;

  constructor() {
    const nav = navigator as NavigatorWithConnection;
    this._connection = nav.connection || nav.mozConnection || nav.webkitConnection;

    this._status = {
      online: navigator.onLine,
      quality: this._estimateQuality(),
      rttMs: this._connection?.rtt ?? null,
      downlinkMbps: this._connection?.downlink ?? null,
      effectiveType: this._connection?.effectiveType ?? null,
    };

    // Bind event handlers
    this._boundOnOnline = () => this._handleConnectivityChange(true);
    this._boundOnOffline = () => this._handleConnectivityChange(false);
    this._boundOnConnectionChange = () => this._handleNetworkInfoChange();

    // Listen for online/offline events
    window.addEventListener('online', this._boundOnOnline);
    window.addEventListener('offline', this._boundOnOffline);

    // Listen for Network Information API changes (if available)
    if (this._connection) {
      this._connection.addEventListener('change', this._boundOnConnectionChange);
    }
  }

  /** Current network status snapshot */
  get status(): NetworkStatus {
    return { ...this._status };
  }

  /** Whether the device is currently online */
  get isOnline(): boolean {
    return this._status.online;
  }

  /** Estimated network quality tier */
  get quality(): NetworkQuality {
    return this._status.quality;
  }

  /** Subscribe to status changes */
  onChange(callback: NetworkEventCallback): () => void {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  /** Update RTT from external source (e.g., WebSocket heartbeat) */
  updateRTT(rttMs: number): void {
    this._status.rttMs = rttMs;
    const newQuality = this._estimateQuality();
    if (newQuality !== this._status.quality) {
      this._status.quality = newQuality;
      this._emit();
    }
  }

  /** Clean up all event listeners */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    window.removeEventListener('online', this._boundOnOnline);
    window.removeEventListener('offline', this._boundOnOffline);

    if (this._connection) {
      this._connection.removeEventListener('change', this._boundOnConnectionChange);
    }

    this._listeners.clear();
  }

  // --- Private ---

  private _handleConnectivityChange(online: boolean): void {
    this._status.online = online;
    this._status.quality = online ? this._estimateQuality() : 'offline';
    this._emit();
  }

  private _handleNetworkInfoChange(): void {
    if (this._connection) {
      this._status.rttMs = this._connection.rtt ?? this._status.rttMs;
      this._status.downlinkMbps = this._connection.downlink ?? this._status.downlinkMbps;
      this._status.effectiveType = this._connection.effectiveType ?? this._status.effectiveType;
    }
    this._status.quality = this._estimateQuality();
    this._emit();
  }

  private _estimateQuality(): NetworkQuality {
    if (!navigator.onLine) return 'offline';

    // Use Network Information API if available
    if (this._connection?.effectiveType) {
      switch (this._connection.effectiveType) {
        case 'slow-2g':
        case '2g':
          return '2g';
        case '3g':
          return '3g';
        case '4g':
          return 'good';
        default:
          return 'good';
      }
    }

    // Fall back to RTT-based estimation
    if (this._status.rttMs !== null) {
      if (this._status.rttMs > 2000) return '2g';
      if (this._status.rttMs > 500) return '3g';
      return 'good';
    }

    // If we can't determine, assume reasonable
    return 'good';
  }

  private _emit(): void {
    const snapshot = this.status;
    this._listeners.forEach((cb) => {
      try {
        cb(snapshot);
      } catch (e) {
        console.error('[NetworkMonitor] Listener error:', e);
      }
    });
  }
}
