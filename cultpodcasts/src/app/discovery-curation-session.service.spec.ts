import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { environment } from '../environments/environment';
import { AuthServiceWrapper } from './auth-service-wrapper.class';
import { DiscoveryCurationSessionSnapshot } from './discovery-curation-session.interface';
import { DiscoveryCurationSessionService } from './discovery-curation-session.service';

describe('DiscoveryCurationSessionService', () => {
  let http: HttpTestingController;
  let service: DiscoveryCurationSessionService;
  let getAccessTokenSilently: ReturnType<typeof vi.fn>;

  const sessionUrl = () => new URL('/discovery-curation/session', environment.api).toString();
  const voteUrl = () => new URL('/discovery-curation/session/vote', environment.api).toString();
  const includeUrl = () => new URL('/discovery-curation/session/include', environment.api).toString();

  const snap = (overrides: Partial<DiscoveryCurationSessionSnapshot> = {}): DiscoveryCurationSessionSnapshot => ({
    includedDocumentIds: ['doc-1'],
    pendingDocumentIds: [],
    selectedResultIds: [],
    votesByResultId: {},
    presence: {},
    rev: 1,
    updatedAt: new Date('2026-10-24T00:00:00Z'),
    ...overrides
  });

  type FakeSocket = {
    url: string;
    readyState: number;
    send: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    onopen: ((ev?: unknown) => void) | null;
    onclose: ((ev?: unknown) => void) | null;
    onmessage: ((ev: { data: string }) => void) | null;
  };

  let sockets: FakeSocket[];
  let OriginalWebSocket: typeof WebSocket;

  async function nextRequest(url: string): Promise<TestRequest> {
    for (let i = 0; i < 30; i++) {
      const matches = http.match(url);
      if (matches.length === 1) {
        return matches[0];
      }
      await Promise.resolve();
    }
    return http.expectOne(url);
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    getAccessTokenSilently = vi.fn().mockReturnValue(of('test-access-token'));
    sockets = [];
    OriginalWebSocket = globalThis.WebSocket;
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = class FakeWebSocket {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSING = 2;
      static readonly CLOSED = 3;
      readyState = FakeWebSocket.CONNECTING;
      send = vi.fn();
      close = vi.fn(() => {
        this.readyState = FakeWebSocket.CLOSED;
        // Do not auto-fire onclose — production close during disconnect must not reconnect.
      });
      onopen: FakeSocket['onopen'] = null;
      onclose: FakeSocket['onclose'] = null;
      onmessage: FakeSocket['onmessage'] = null;
      constructor(public url: string) {
        sockets.push(this as unknown as FakeSocket);
        queueMicrotask(() => {
          this.readyState = FakeWebSocket.OPEN;
          this.onopen?.(undefined);
        });
      }
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthServiceWrapper,
          useValue: { authService: { getAccessTokenSilently }, roles: of([]) }
        },
        DiscoveryCurationSessionService
      ]
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(DiscoveryCurationSessionService);
  });

  afterEach(() => {
    service.disconnect();
    http.verify();
    (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket = OriginalWebSocket;
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('opens WebSocket with query access_token only (no bearer subprotocol)', async () => {
    const connectPromise = service.connect();
    const req = await nextRequest(sessionUrl());
    req.flush(snap());
    await connectPromise;
    await Promise.resolve();

    expect(sockets.length).toBe(1);
    const url = sockets[0].url;
    expect(url).toContain('/discovery-curation/session/ws');
    expect(url).toContain('access_token=test-access-token');
    expect(url).not.toMatch(/bearer/i);
    expect(service.connected()).toBe(true);
  });

  it('gives WebSocket snapshots the same Dates as the HTTP snapshot (#579)', async () => {
    const connectPromise = service.connect();
    (await nextRequest(sessionUrl())).flush(snap());
    await connectPromise;
    await Promise.resolve();

    sockets[0].onmessage?.({
      data: JSON.stringify({
        type: 'state',
        state: {
          ...snap({ rev: 3 }),
          updatedAt: '2026-10-31T10:00:00.123Z',
          presence: { u1: '2026-10-31T10:00:01Z' },
          votesByResultId: { r1: { votes: [{ userId: 'u1', role: 'Curator', at: '2026-10-31T09:59:59Z' }], rev: 1, provisional: false } }
        }
      })
    });

    const state = service.snapshot()!;
    expect(state.rev).toBe(3);
    expect(state.updatedAt).toBeInstanceOf(Date);
    expect(state.updatedAt.toISOString()).toBe('2026-10-31T10:00:00.123Z');
    expect(state.presence['u1']).toBeInstanceOf(Date);
    expect(state.votesByResultId['r1'].votes[0].at.toISOString()).toBe('2026-10-31T09:59:59.000Z');
  });

  it('votes over WebSocket when OPEN, otherwise POSTs /session/vote', async () => {
    const connectPromise = service.connect();
    (await nextRequest(sessionUrl())).flush(snap());
    await connectPromise;
    await Promise.resolve();

    await service.setVote('result-1', true);
    expect(sockets[0].send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'vote', resultId: 'result-1', selected: true })
    );
    expect(http.match(voteUrl()).length).toBe(0);

    sockets[0].readyState = 3; // CLOSED
    const votePromise = service.setVote('result-2', false);
    const req = await nextRequest(voteUrl());
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ resultId: 'result-2', selected: false });
    req.flush(snap({ rev: 2, selectedResultIds: [] }));
    await votePromise;
    expect(service.snapshot()?.rev).toBe(2);
  });

  it('disconnect prevents reconnect after socket close', async () => {
    vi.useFakeTimers();
    const connectPromise = service.connect();
    (await nextRequest(sessionUrl())).flush(snap());
    await connectPromise;
    await Promise.resolve();
    expect(sockets.length).toBe(1);

    service.disconnect();
    expect(service.connected()).toBe(false);

    // Simulate late close after disconnect — must not schedule reconnect.
    sockets[0].onclose?.(undefined);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(sockets.length).toBe(1);
  });

  it('connect catches refresh failure and still opens the socket', async () => {
    const connectPromise = service.connect();
    (await nextRequest(sessionUrl())).flush(
      { message: 'nope' },
      { status: 500, statusText: 'Server Error' }
    );
    await connectPromise;
    await Promise.resolve();

    expect(service.refreshError()).toBe(true);
    expect(sockets.length).toBe(1);
    expect(sockets[0].url).toContain('access_token=');
  });

  it('includePending returns false on HTTP failure', async () => {
    const pending = service.includePending('all');
    const req = await nextRequest(includeUrl());
    req.flush({ message: 'fail' }, { status: 502, statusText: 'Bad Gateway' });
    await expect(pending).resolves.toBe(false);
  });

  it('schedules reconnect with backoff after close while not disconnected', async () => {
    vi.useFakeTimers();
    const connectPromise = service.connect();
    (await nextRequest(sessionUrl())).flush(snap());
    await connectPromise;
    await Promise.resolve();
    expect(sockets.length).toBe(1);

    sockets[0].readyState = 3;
    sockets[0].onclose?.(undefined);

    // First reconnect ~1s + jitter (< 2s)
    await vi.advanceTimersByTimeAsync(2000);
    expect(sockets.length).toBe(2);
  });
});
