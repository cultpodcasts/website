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
import {
  ServiceLinkConflictAnswer,
  ServiceLinkConflictDialogComponent
} from '../service-link-conflict-dialog/service-link-conflict-dialog.component';

describe('SendPodcastComponent service-link conflict (RPP #1416)', () => {
  let http: HttpTestingController;
  const submitUrl = new URL('/submit', environment.api).toString();

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

  afterEach(() => http.verify());

  function create(answer: ServiceLinkConflictAnswer | undefined) {
    const fixture = TestBed.createComponent(SendPodcastComponent);
    const dialog = fixture.debugElement.injector.get(MatDialog);
    const openDialog = vi.spyOn(dialog, 'open').mockReturnValue({ afterClosed: () => of(answer) } as never);
    return { component: fixture.componentInstance, openDialog };
  }

  const share = {
    url: new URL('https://open.spotify.com/episode/abcdefghijklmnopqrstuv'),
    podcastId: undefined,
    podcastName: undefined,
    shareMode: ShareMode.Text
  };

  const serviceLinkConflict = {
    episodeId: '7d5f6a1e-2b3c-4d5e-8f90-1a2b3c4d5e6f',
    episodeTitle: 'Synthetic Episode',
    episodeRelease: '2026-01-02T03:04:05Z',
    links: [
      {
        service: 'spotify',
        storedUrl: 'https://open.spotify.com/episode/storedstoredstoredstor',
        submittedUrl: 'https://open.spotify.com/episode/abcdefghijklmnopqrstuv'
      }
    ]
  };

  it('opens the conflict dialog with the held episode and resubmits overwrite with its episode id', async () => {
    const { component, openDialog } = create('overwrite');
    const done = component.submit(share);
    const probe = await vi.waitFor(() => http.expectOne(submitUrl));
    expect(probe.request.body.serviceLinkConflictDecision).toBeUndefined();
    probe.flush({ serviceLinkConflict });
    await vi.waitFor(() => expect(openDialog).toHaveBeenCalled());
    expect(openDialog.mock.calls[0][0]).toBe(ServiceLinkConflictDialogComponent);
    expect((openDialog.mock.calls[0][1] as { data: unknown }).data).toEqual(serviceLinkConflict);
    const overwrite = await vi.waitFor(() => http.expectOne(submitUrl));
    expect(overwrite.request.body.serviceLinkConflictDecision).toBe('overwrite');
    expect(overwrite.request.body.serviceLinkConflictEpisodeId).toBe(serviceLinkConflict.episodeId);
    overwrite.flush({ success: { episode: 'Enriched', podcast: 'None' } }, { headers: { 'X-Origin': '1' } });
    await done;
    expect(component.submitted).toBe(true);
    expect(component.submitError()).toBe(false);
  });

  it('resubmits create-new without an episode id', async () => {
    const { component } = create('create-new');
    const done = component.submit(share);
    const probe = await vi.waitFor(() => http.expectOne(submitUrl));
    probe.flush({ serviceLinkConflict });
    const createNew = await vi.waitFor(() => http.expectOne(submitUrl));
    expect(createNew.request.body.serviceLinkConflictDecision).toBe('create-new');
    expect('serviceLinkConflictEpisodeId' in createNew.request.body).toBe(false);
    createNew.flush({ success: { episode: 'Created', podcast: 'None' } });
    await done;
    expect(component.submitted).toBe(true);
  });

  it.each([['cancel' as const], [undefined]])('posts nothing more when the conflict dialog answers %s', async answer => {
    const { component } = create(answer);
    const done = component.submit(share);
    const probe = await vi.waitFor(() => http.expectOne(submitUrl));
    probe.flush({ serviceLinkConflict });
    await done;
    http.expectNone(submitUrl);
    expect(component.submitted).toBe(false);
    expect(component.isSending()).toBe(false);
  });

  it('is not a success when a conflict is still held after the decision loop', async () => {
    const { component } = create('overwrite');
    const done = component.submit(share);
    const probe = await vi.waitFor(() => http.expectOne(submitUrl));
    probe.flush({ serviceLinkConflict });
    for (let i = 0; i < 4; i++) {
      const next = await vi.waitFor(() => http.expectOne(submitUrl));
      next.flush({ serviceLinkConflict });
    }
    await done;
    expect(component.submitted).toBe(false);
    expect(component.submitError()).toBe(true);
  });
});
