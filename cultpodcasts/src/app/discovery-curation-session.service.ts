import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';
import { AuthServiceWrapper } from './auth-service-wrapper.class';
import { DISCOVERY_SUBMIT_SCOPE } from './discovery-supervision/discovery-supervision';
import { DiscoveryCurationSessionSnapshot } from './discovery-curation-session.interface';
import { convertJsonDates } from './json-date.interceptor';

/** Cap for WS reconnect delay (ms). */
const RECONNECT_DELAY_CAP_MS = 30_000;
/** After this many failed reconnects, wait a full minute until the next try. */
const RECONNECT_SLOW_AFTER = 8;
const RECONNECT_SLOW_MS = 60_000;

/**
 * Global discovery curation room: HTTP + WebSocket sync of vote sets / sticky include.
 * Mode A: any vote ≥1 enables Save; supervised-only votes are marked provisional.
 */
@Injectable({ providedIn: 'root' })
export class DiscoveryCurationSessionService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthServiceWrapper);

  readonly snapshot = signal<DiscoveryCurationSessionSnapshot | null>(null);
  readonly connected = signal(false);
  /** Set when the last HTTP session refresh failed (connect still attempts WS). */
  readonly refreshError = signal(false);

  private socket: WebSocket | null = null;
  private closed = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnDestroy(): void {
    this.disconnect();
  }

  async connect(): Promise<void> {
    this.closed = false;
    this.reconnectAttempt = 0;
    this.clearReconnectTimer();
    try {
      await this.refresh();
      this.refreshError.set(false);
    } catch {
      this.refreshError.set(true);
      this.connected.set(false);
    }
    // WS can still sync state when the initial GET is transiently down.
    await this.openSocket();
  }

  disconnect(): void {
    this.closed = true;
    this.clearReconnectTimer();
    this.reconnectAttempt = 0;
    this.socket?.close();
    this.socket = null;
    this.connected.set(false);
  }

  async refresh(): Promise<DiscoveryCurationSessionSnapshot | null> {
    const headers = await this.authHeaders();
    if (!headers) {
      return null;
    }
    const url = new URL('/discovery-curation/session', environment.api).toString();
    const snap = await firstValueFrom(this.http.get<DiscoveryCurationSessionSnapshot>(url, { headers }));
    this.snapshot.set(snap);
    return snap;
  }

  /** @returns false when auth/HTTP failed (callers may snackbar). */
  async syncDocuments(documentIds: string[]): Promise<boolean> {
    try {
      const headers = await this.authHeaders();
      if (!headers) {
        return false;
      }
      const url = new URL('/discovery-curation/session/sync-documents', environment.api).toString();
      const snap = await firstValueFrom(
        this.http.post<DiscoveryCurationSessionSnapshot>(url, { documentIds }, { headers }));
      this.snapshot.set(snap);
      return true;
    } catch {
      return false;
    }
  }

  /** @returns false when auth/HTTP failed (callers may snackbar). */
  async includePending(documentIds: string[] | 'all' = 'all'): Promise<boolean> {
    try {
      const headers = await this.authHeaders();
      if (!headers) {
        return false;
      }
      const url = new URL('/discovery-curation/session/include', environment.api).toString();
      const snap = await firstValueFrom(
        this.http.post<DiscoveryCurationSessionSnapshot>(url, { documentIds }, { headers }));
      this.snapshot.set(snap);
      return true;
    } catch {
      return false;
    }
  }

  async setVote(resultId: string, selected: boolean): Promise<void> {
    try {
      const headers = await this.authHeaders();
      if (!headers) {
        return;
      }
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'vote', resultId, selected }));
        return;
      }
      const url = new URL('/discovery-curation/session/vote', environment.api).toString();
      const snap = await firstValueFrom(
        this.http.post<DiscoveryCurationSessionSnapshot>(url, { resultId, selected }, { headers }));
      this.snapshot.set(snap);
    } catch {
      /* void callers must not surface unhandled rejections */
    }
  }

  async clearVotes(resultIds: string[]): Promise<void> {
    try {
      const headers = await this.authHeaders();
      if (!headers) {
        return;
      }
      const url = new URL('/discovery-curation/session/clear-votes', environment.api).toString();
      const snap = await firstValueFrom(
        this.http.post<DiscoveryCurationSessionSnapshot>(url, { resultIds }, { headers }));
      this.snapshot.set(snap);
    } catch {
      /* void callers must not surface unhandled rejections */
    }
  }

  private async openSocket(): Promise<void> {
    if (this.closed) {
      return;
    }
    const token = await firstValueFrom(this.auth.authService.getAccessTokenSilently({
      authorizationParams: {
        audience: 'https://api.cultpodcasts.com/',
        scope: DISCOVERY_SUBMIT_SCOPE
      }
    })).catch(() => '');
    if (!token || this.closed) {
      this.scheduleReconnect();
      return;
    }
    const base = new URL('/discovery-curation/session/ws', environment.api);
    // Browsers cannot set Authorization on WebSocket upgrade; Worker accepts ?access_token=.
    const wsUrl = base.toString().replace(/^http/, 'ws') + `?access_token=${encodeURIComponent(token)}`;
    try {
      this.socket?.close();
      this.socket = new WebSocket(wsUrl);
      this.socket.onopen = () => {
        this.reconnectAttempt = 0;
        this.connected.set(true);
      };
      this.socket.onclose = () => {
        this.connected.set(false);
        this.scheduleReconnect();
      };
      this.socket.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as { type?: string; state?: DiscoveryCurationSessionSnapshot };
          if (msg.state) {
            // WebSocket frames skip JsonDateInterceptor; give them the same Dates as the HTTP snapshot.
            // A new free-text snapshot field must be passed here as a keep-as-text key (see DiscoveryCurationSessionSnapshot).
            this.snapshot.set(convertJsonDates(msg.state));
          }
        } catch {
          /* ignore malformed frames */
        }
      };
    } catch {
      this.connected.set(false);
      this.scheduleReconnect();
    }
  }

  /** Exponential backoff + jitter, capped; slows after RECONNECT_SLOW_AFTER failures. */
  private scheduleReconnect(): void {
    if (this.closed) {
      return;
    }
    this.clearReconnectTimer();
    const attempt = this.reconnectAttempt++;
    const jitter = Math.floor(Math.random() * 500);
    const delay = attempt >= RECONNECT_SLOW_AFTER
      ? RECONNECT_SLOW_MS + jitter
      : Math.min(RECONNECT_DELAY_CAP_MS, 1000 * Math.pow(2, attempt)) + jitter;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.openSocket();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer != null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private async authHeaders(): Promise<HttpHeaders | null> {
    const token = await firstValueFrom(this.auth.authService.getAccessTokenSilently({
      authorizationParams: {
        audience: 'https://api.cultpodcasts.com/',
        scope: DISCOVERY_SUBMIT_SCOPE
      }
    })).catch(() => '');
    if (!token) {
      return null;
    }
    return new HttpHeaders().set('Authorization', `Bearer ${token}`);
  }
}
