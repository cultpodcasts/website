import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';
import { authInterceptor } from '../auth.interceptor';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import {
  YOU_TUBE_PLAYLIST_CHANNEL_MISMATCH,
  YOU_TUBE_PLAYLIST_ID_INVALID,
  YOU_TUBE_PLAYLIST_LOOKUP_FAILED,
  YOU_TUBE_PLAYLIST_NOT_FOUND,
  YOU_TUBE_PLAYLIST_NOT_FOUND_MESSAGE,
  YOU_TUBE_PLAYLIST_OWNER_LOOKUP_FAILED_MESSAGE
} from '../youtube-playlist-edit-error';
import { EditPodcastSendComponent } from './edit-podcast-send.component';

const podcastId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const patchUrl = new URL(`/podcast/${podcastId}`, environment.api).toString();

describe('EditPodcastSendComponent', () => {
  let close: ReturnType<typeof vi.fn>;
  let fixture: ComponentFixture<EditPodcastSendComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    close = vi.fn();
    await TestBed.configureTestingModule({
      imports: [EditPodcastSendComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: { close } },
        { provide: AuthServiceWrapper, useValue: { authService: { getAccessTokenSilently: () => of('test-token') } } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(EditPodcastSendComponent);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the Api id-invalid message and keeps the dialog open (edits stay on the parent)', async () => {
    const message =
      "YouTube playlist id 'not-a-playlist' is invalid. Use a playlist id like PL… (Did you mean UC… as a channel id?).";
    fixture.componentInstance.submit(podcastId, { youTubePlaylistId: 'not-a-playlist' });
    fixture.detectChanges();
    const req = http.expectOne(patchUrl);
    req.flush({ error: message, code: YOU_TUBE_PLAYLIST_ID_INVALID }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(root().querySelector('#error')?.textContent?.trim()).toBe(message);
    expect(root().textContent).not.toContain('Try again');
    expect(close).not.toHaveBeenCalled();
  });

  it('shows the Api mismatch message for a legacy channel-mismatch 400', async () => {
    const message = 'Playlist PLsynthetic is owned by channel UCsyntheticother; change the playlist.';
    fixture.componentInstance.submit(podcastId, { youTubePlaylistId: 'PLsyntheticplaylist0001' });
    fixture.detectChanges();
    const req = http.expectOne(patchUrl);
    req.flush({ error: message, code: YOU_TUBE_PLAYLIST_CHANNEL_MISMATCH }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(root().querySelector('#error')?.textContent?.trim()).toBe(message);
    expect(root().textContent).not.toContain('Try again');
    expect(close).not.toHaveBeenCalled();
  });

  it('shows the fixed not-found copy for youTubePlaylistNotFound', () => {
    fixture.componentInstance.submit(podcastId, { youTubePlaylistId: 'PLmissing' });
    fixture.detectChanges();
    http.expectOne(patchUrl).flush(
      { error: 'not found detail', code: YOU_TUBE_PLAYLIST_NOT_FOUND },
      { status: 400, statusText: 'Bad Request' }
    );
    fixture.detectChanges();
    expect(root().querySelector('#error')?.textContent?.trim()).toBe(YOU_TUBE_PLAYLIST_NOT_FOUND_MESSAGE);
  });

  it('offers Try again on a retryable playlist owner lookup failure and re-PATCHes', () => {
    fixture.componentInstance.submit(podcastId, { youTubePlaylistId: 'PLsyntheticplaylist0001' });
    fixture.detectChanges();
    http.expectOne(patchUrl).flush(
      { error: 'lookup failed', code: YOU_TUBE_PLAYLIST_LOOKUP_FAILED, retryable: true },
      { status: 503, statusText: 'Service Unavailable' }
    );
    fixture.detectChanges();
    expect(root().querySelector('#error')?.textContent?.trim()).toBe(YOU_TUBE_PLAYLIST_OWNER_LOOKUP_FAILED_MESSAGE);
    const retry = Array.from(root().querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Try again');
    expect(retry).toBeTruthy();
    retry!.click();
    fixture.detectChanges();
    const second = http.expectOne(patchUrl);
    expect(second.request.method).toBe('PATCH');
    expect(second.request.body).toEqual({ youTubePlaylistId: 'PLsyntheticplaylist0001' });
    second.flush(null, { status: 202, statusText: 'Accepted' });
    expect(close).toHaveBeenCalledWith({ updated: true, response: null });
  });
});
