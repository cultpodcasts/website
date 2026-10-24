import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';
import { AuthServiceWrapper } from './auth-service-wrapper.class';
import { DISCOVERY_SUBMIT_SCOPE } from './discovery-supervision/discovery-supervision';
import { DiscoveryCurationSessionSnapshot } from './discovery-curation-session.interface';

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

  private socket: WebSocket | null = null;
  private closed = false;

  ngOnDestroy(): void {
    this.closed = true;
    this.socket?.close();
    this.socket = null;
  }

  async connect(): Promise<void> {
    this.closed = false;
    await this.refresh();
    await this.openSocket();
  }

  disconnect(): void {
    this.closed = true;
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

  async syncDocuments(documentIds: string[]): Promise<void> {
    try {
      const headers = await this.authHeaders();
      if (!headers) {
        return;
      }
      const url = new URL('/discovery-curation/session/sync-documents', environment.api).toString();
      const snap = await firstValueFrom(
        this.http.post<DiscoveryCurationSessionSnapshot>(url, { documentIds }, { headers }));
      this.snapshot.set(snap);
    } catch {
      /* void callers must not surface unhandled rejections */
    }
  }

  async includePending(documentIds: string[] | 'all' = 'all'): Promise<void> {
    try {
      const headers = await this.authHeaders();
      if (!headers) {
        return;
      }
      const url = new URL('/discovery-curation/session/include', environment.api).toString();
      const snap = await firstValueFrom(
        this.http.post<DiscoveryCurationSessionSnapshot>(url, { documentIds }, { headers }));
      this.snapshot.set(snap);
    } catch {
      /* void callers must not surface unhandled rejections */
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
    const token = await firstValueFrom(this.auth.authService.getAccessTokenSilently({
      authorizationParams: {
        audience: 'https://api.cultpodcasts.com/',
        scope: DISCOVERY_SUBMIT_SCOPE
      }
    })).catch(() => '');
    if (!token || this.closed) {
      return;
    }
    const base = new URL('/discovery-curation/session/ws', environment.api);
    // Browsers cannot set Authorization on WebSocket upgrade; Worker accepts ?access_token=.
    const wsUrl = base.toString().replace(/^http/, 'ws') + `?access_token=${encodeURIComponent(token)}`;
    try {
      this.socket?.close();
      this.socket = new WebSocket(wsUrl);
      this.socket.onopen = () => this.connected.set(true);
      this.socket.onclose = () => {
        this.connected.set(false);
        if (!this.closed) {
          setTimeout(() => void this.openSocket(), 3000);
        }
      };
      this.socket.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as { type?: string; state?: DiscoveryCurationSessionSnapshot };
          if (msg.state) {
            this.snapshot.set(msg.state);
          }
        } catch {
          /* ignore */
        }
      };
    } catch {
      this.connected.set(false);
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
