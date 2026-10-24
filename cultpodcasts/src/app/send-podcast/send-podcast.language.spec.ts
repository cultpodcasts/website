import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { environment } from '../../environments/environment';
import { ShareMode } from '../share-mode.enum';
import { SendPodcastComponent } from './send-podcast.component';
import { SubmitSeriesResolveService } from '../submit-series-resolve.service';

describe('SendPodcastComponent unsupported language', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SendPodcastComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        {
          provide: AuthServiceWrapper,
          useValue: {
            authService: { isAuthenticated$: of(false), getAccessTokenSilently: () => of('token') },
            roles: of([])
          }
        },
        { provide: SubmitSeriesResolveService, useValue: {} }
      ]
    });
    http = TestBed.inject(HttpTestingController);
  });

  function create(answer: 'add' | 'continue' | 'cancel' = 'cancel') {
    const fixture = TestBed.createComponent(SendPodcastComponent);
    const dialog = fixture.debugElement.injector.get(MatDialog);
    const openDialog = vi.spyOn(dialog, 'open').mockReturnValue({ afterClosed: () => of(answer) } as never);
    return { component: fixture.componentInstance, openDialog };
  }

  const share = {
    url: new URL('https://www.youtube.com/watch?v=abcdefghijk'),
    podcastId: undefined,
    podcastName: undefined,
    shareMode: ShareMode.Text
  };

  it('shows the language prompt before the creating submit', async () => {
    const { component, openDialog } = create('add');
    const done = component.submit(share);
    const probe = await vi.waitFor(() => http.expectOne(new URL('/submit', environment.api).toString()));
    expect(openDialog).not.toHaveBeenCalled();
    probe.flush({
      languageDecision: {
        code: 'is',
        name: 'Icelandic',
        signals: [{ field: 'episodeTitle', label: 'Episode title', excerpt: 'ekki', reason: 'Matched Icelandic words: ekki' }]
      }
    }, { headers: { 'X-Origin': '1' } });
    await vi.waitFor(() => expect(openDialog).toHaveBeenCalled());
    const creating = await vi.waitFor(() => http.expectOne(new URL('/submit', environment.api).toString()));
    expect(creating.request.body.languageDecision).toBe('add');
    creating.flush({
      success: { episode: 'Created', podcast: 'Created', defaultLanguageFromDetection: true }
    }, { headers: { 'X-Origin': '1' } });
    await done;
    expect(component.submitted).toBe(true);
  });

  it('does not post a create when the unsupported-language prompt is cancelled', async () => {
    const { component } = create('cancel');
    const done = component.submit(share);
    const probe = await vi.waitFor(() => http.expectOne(new URL('/submit', environment.api).toString()));
    probe.flush({
      languageDecision: {
        code: 'is',
        name: 'Icelandic',
        signals: [{ field: 'parentTitle', label: 'Podcast title', excerpt: 'ekki', reason: 'Matched Icelandic words: ekki' }]
      }
    });
    await done;
    http.expectNone(new URL('/submit', environment.api).toString());
    expect(component.submitted).toBe(false);
  });
});
