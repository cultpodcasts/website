import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';
import { authInterceptor } from '../auth.interceptor';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import {
  IndexBacklogConfirmDialogComponent,
  IndexBacklogConfirmDialogData,
  previewErrorMessage
} from './index-backlog-confirm-dialog.component';

describe('IndexBacklogConfirmDialogComponent', () => {
  let close: ReturnType<typeof vi.fn>;
  let getAccessTokenSilently: ReturnType<typeof vi.fn>;
  const data: IndexBacklogConfirmDialogData = { podcastName: 'Show & Co' };
  const previewUrl = new URL('/podcast/index/Show%20%26%20Co/backlog/preview', environment.api).toString();

  beforeEach(async () => {
    close = vi.fn();
    getAccessTokenSilently = vi.fn(() => of('test-token'));
    await TestBed.configureTestingModule({
      imports: [IndexBacklogConfirmDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: AuthServiceWrapper, useValue: { authService: { getAccessTokenSilently } } }
      ]
    }).compileComponents();
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  async function settle(): Promise<void> {
    for (let i = 0; i < 8; i++) {
      await Promise.resolve();
    }
  }

  async function open() {
    const fixture = TestBed.createComponent(IndexBacklogConfirmDialogComponent);
    fixture.detectChanges();
    await settle();
    const request = TestBed.inject(HttpTestingController).expectOne(previewUrl);
    return { fixture, request };
  }

  it('asks the preview endpoint with an admin token and shows the episode count with Cancel and Index backlog', async () => {
    const { fixture, request } = await open();

    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    expect(getAccessTokenSilently).toHaveBeenCalledWith(
      expect.objectContaining({ authorizationParams: expect.objectContaining({ scope: 'admin' }) })
    );
    request.flush({ newEpisodeCount: 12, ignoredEpisodeCount: 0 });
    await settle();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('12 new episodes will be ingested');
    expect(host.textContent).not.toContain('ignored');
    const labels = Array.from(host.querySelectorAll('button')).map(b => b.textContent?.trim());
    expect(labels).toEqual(['Cancel', 'Index backlog']);
  });

  it('says how many of the episodes will be added as ignored, and uses the singular for one', async () => {
    const { fixture, request } = await open();
    request.flush({ newEpisodeCount: 1, ignoredEpisodeCount: 1 });
    await settle();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('1 new episode will be ingested');
    expect(text).toContain('1 of them will be added as ignored');
  });

  it('closes true only when the admin picks Index backlog', async () => {
    const { fixture, request } = await open();
    request.flush({ newEpisodeCount: 3, ignoredEpisodeCount: 0 });
    await settle();
    fixture.detectChanges();
    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));

    buttons.find(b => b.textContent?.trim() === 'Index backlog')!.click();

    expect(close).toHaveBeenCalledWith(true);
  });

  it('closes false on Cancel so nothing is indexed', async () => {
    const { fixture, request } = await open();
    request.flush({ newEpisodeCount: 3, ignoredEpisodeCount: 0 });
    await settle();
    fixture.detectChanges();
    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));

    buttons.find(b => b.textContent?.trim() === 'Cancel')!.click();

    expect(close).toHaveBeenCalledWith(false);
    expect(close).not.toHaveBeenCalledWith(true);
  });

  it('offers only Close when nothing new would be ingested', async () => {
    const { fixture, request } = await open();
    request.flush({ newEpisodeCount: 0, ignoredEpisodeCount: 0 });
    await settle();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Nothing new to ingest');
    expect(Array.from(host.querySelectorAll('button')).map(b => b.textContent?.trim())).toEqual(['Close']);
  });

  async function failWith(status: number, statusText: string) {
    const { fixture, request } = await open();
    request.flush({}, { status, statusText });
    await settle();
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const buttons = Array.from(host.querySelectorAll('button'));
    return { host, buttons, labels: buttons.map(b => b.textContent?.trim()) };
  }

  it('offers Cancel and Index backlog with "Count unavailable - index anyway?" when the count times out (504)', async () => {
    const { host, labels } = await failWith(504, 'Gateway Timeout');

    expect(host.textContent).toContain('Counting the episodes ran out of time');
    expect(host.textContent).toContain('Count unavailable - index anyway?');
    expect(labels).toEqual(['Cancel', 'Index backlog']);
  });

  it('offers Cancel and Index backlog when the count fails with a server error (500)', async () => {
    const { host, labels } = await failWith(500, 'Internal Server Error');

    expect(host.textContent).toContain('The episodes could not be counted');
    expect(host.textContent).toContain('Count unavailable - index anyway?');
    expect(labels).toEqual(['Cancel', 'Index backlog']);
  });

  it('offers Cancel and Index backlog when the count fails without a response (network error)', async () => {
    const { fixture, request } = await open();
    request.error(new ProgressEvent('error'));
    await settle();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Count unavailable - index anyway?');
    expect(Array.from(host.querySelectorAll('button')).map(b => b.textContent?.trim())).toEqual(['Cancel', 'Index backlog']);
  });

  it('closes true on Index backlog after a timed-out count so the admin can still start the index', async () => {
    const { buttons } = await failWith(504, 'Gateway Timeout');
    buttons.find(b => b.textContent?.trim() === 'Index backlog')!.click();
    expect(close).toHaveBeenCalledWith(true);
  });

  it('closes false on Cancel after a timed-out count so nothing is indexed', async () => {
    const { buttons } = await failWith(504, 'Gateway Timeout');
    buttons.find(b => b.textContent?.trim() === 'Cancel')!.click();
    expect(close).toHaveBeenCalledWith(false);
    expect(close).not.toHaveBeenCalledWith(true);
  });

  it('offers only Close when the podcast cannot be indexed (400)', async () => {
    const { host, labels } = await failWith(400, 'Bad Request');

    expect(host.textContent).toContain('cannot be indexed');
    expect(host.textContent).not.toContain('index anyway');
    expect(labels).toEqual(['Close']);
  });

  it('offers only Close when the podcast is not found (404)', async () => {
    const { host, labels } = await failWith(404, 'Not Found');

    expect(host.textContent).toContain('Podcast not found.');
    expect(host.textContent).not.toContain('index anyway');
    expect(labels).toEqual(['Close']);
  });

  it('maps each failed dry run to words the admin can act on', () => {
    const failure = (status: number) => new HttpErrorResponse({ status });
    expect(previewErrorMessage(failure(400))).toContain('cannot be indexed');
    expect(previewErrorMessage(failure(404))).toBe('Podcast not found.');
    expect(previewErrorMessage(failure(504))).toContain('ran out of time');
    expect(previewErrorMessage(failure(500))).toContain('could not be counted');
    expect(previewErrorMessage(new Error('offline'))).toContain('could not be counted');
  });
});