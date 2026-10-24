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
import { AmbiguousIdentityAnswer } from '../ambiguous-identity-dialog/ambiguous-identity-dialog.component';

describe('SendPodcastComponent ambiguous identity', () => {
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

  function create(answer: AmbiguousIdentityAnswer) {
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

  const identityDecision = {
    target: 'Film',
    query: 'Synthetic Title',
    candidates: [
      { key: 'tmdb:11', title: 'Synthetic Title', year: 2020, kind: 'Film', source: 'tmdb', tmdbId: 11 },
      { key: 'tmdb:22', title: 'Synthetic Title', year: 2021, kind: 'Film', source: 'tmdb', tmdbId: 22 }
    ]
  };

  it('shows the identity prompt before the creating submit and retries with the selected key', async () => {
    const { component, openDialog } = create({ decision: 'select', key: 'tmdb:11' });
    const done = component.submit(share);
    const probe = await vi.waitFor(() => http.expectOne(new URL('/submit', environment.api).toString()));
    expect(openDialog).not.toHaveBeenCalled();
    probe.flush({ identityDecision }, { headers: { 'X-Origin': '1' } });
    await vi.waitFor(() => expect(openDialog).toHaveBeenCalled());
    const creating = await vi.waitFor(() => http.expectOne(new URL('/submit', environment.api).toString()));
    expect(creating.request.body.identityDecision).toBe('select');
    expect(creating.request.body.selectedIdentityKey).toBe('tmdb:11');
    creating.flush({
      success: { episode: 'Created', podcast: 'None', contentKind: 'Film' }
    }, { headers: { 'X-Origin': '1' } });
    await done;
    expect(component.submitted).toBe(true);
  });

  it('does not post a create when the identity prompt is cancelled', async () => {
    const { component } = create({ decision: 'cancel' });
    const done = component.submit(share);
    const probe = await vi.waitFor(() => http.expectOne(new URL('/submit', environment.api).toString()));
    probe.flush({ identityDecision });
    await done;
    http.expectNone(new URL('/submit', environment.api).toString());
    expect(component.submitted).toBe(false);
  });

  it('handles language then identity when both appear across sequential 200s', async () => {
    const fixture = TestBed.createComponent(SendPodcastComponent);
    const dialog = fixture.debugElement.injector.get(MatDialog);
    let openCount = 0;
    vi.spyOn(dialog, 'open').mockImplementation(() => {
      openCount += 1;
      return {
        afterClosed: () => of(openCount === 1 ? 'continue' : { decision: 'select', key: 'tmdb:11' })
      } as never;
    });
    const component = fixture.componentInstance;
    const done = component.submit(share);
    const languageProbe = await vi.waitFor(() => http.expectOne(new URL('/submit', environment.api).toString()));
    languageProbe.flush({
      languageDecision: {
        code: 'is',
        name: 'Icelandic',
        signals: [{ field: 'episodeTitle', label: 'Episode title', excerpt: 'ekki', reason: 'Matched Icelandic words: ekki' }]
      }
    });
    const afterLanguage = await vi.waitFor(() => http.expectOne(new URL('/submit', environment.api).toString()));
    expect(afterLanguage.request.body.languageDecision).toBe('continue');
    afterLanguage.flush({ identityDecision });
    const creating = await vi.waitFor(() => http.expectOne(new URL('/submit', environment.api).toString()));
    expect(creating.request.body.identityDecision).toBe('select');
    expect(creating.request.body.selectedIdentityKey).toBe('tmdb:11');
    creating.flush({ success: { episode: 'Created', podcast: 'None', contentKind: 'Film' } }, { headers: { 'X-Origin': '1' } });
    await done;
    expect(component.submitted).toBe(true);
    expect(component.submitError()).toBe(false);
  });

  it('sets submitError when a gate remains after the decision loop', async () => {
    const { component } = create({ decision: 'select', key: 'tmdb:11' });
    const done = component.submit(share);
    const probe = await vi.waitFor(() => http.expectOne(new URL('/submit', environment.api).toString()));
    probe.flush({ identityDecision });
    for (let i = 0; i < 4; i++) {
      const next = await vi.waitFor(() => http.expectOne(new URL('/submit', environment.api).toString()));
      next.flush({ identityDecision });
    }
    await done;
    expect(component.submitted).toBe(false);
    expect(component.submitError()).toBe(true);
  });
});
