import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, of } from 'rxjs';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { SiteService } from '../site.service';
import { HeroCurationService } from '../hero-curation.service';
import { OutgoingEpisodesApiComponent } from './outgoing-episodes-api.component';

describe('OutgoingEpisodesApiComponent after an edit-podcast save', () => {
  let http: HttpTestingController;
  let dialog: { open: ReturnType<typeof vi.fn> };
  let snackBar: { open: ReturnType<typeof vi.fn> };

  const podId = '77777777-7777-4777-8777-777777777777';
  const otherPodId = '88888888-8888-4888-8888-888888888888';
  const inherits = '99999999-9999-4999-8999-999999999999';
  const otherPodcast = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab';
  const body = (id: string, podcastId: string, lang?: string) => ({
    id, title: `Synthetic ${id.slice(0, 4)}`, podcastId, podcastName: podcastId === podId ? 'Synthetic Pod' : 'Other Pod',
    description: '', posted: false, tweeted: false, ignored: false, removed: false, explicit: false,
    release: '2026-01-02T00:00:00Z', duration: '00:09:18', subjects: [], lang,
  });

  beforeEach(async () => {
    localStorage.clear();
    dialog = { open: vi.fn() };
    snackBar = { open: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [OutgoingEpisodesApiComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: ActivatedRoute, useValue: { params: new BehaviorSubject<Record<string, string>>({}) } },
        { provide: AuthServiceWrapper, useValue: { roles: of(['Curator']), authService: { getAccessTokenSilently: vi.fn(() => of('tok')) } } },
        { provide: SiteService, useValue: { setQuery: vi.fn(), setPodcast: vi.fn(), setSubject: vi.fn() } },
        { provide: HeroCurationService, useValue: { getHeroCuration: vi.fn(() => Promise.resolve({ episodeIds: [], updatedAt: null })), toggleEpisode: vi.fn() } },
        { provide: MatDialog, useValue: dialog },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  const flushTicks = () => new Promise(r => setTimeout(r, 0));
  const episodeReqs = () => http.match(r => new URL(r.url).pathname.startsWith('/episode/'));
  /** Each card's flag after the duration, in list order (inheriting card first, other podcast second). */
  const flags = (el: HTMLElement) => [...el.querySelectorAll('mat-card.curator-card')]
    .map(c => c.querySelector('.curator-card__lang')?.textContent?.trim() ?? null);

  async function loadOutgoing() {
    const fixture = TestBed.createComponent(OutgoingEpisodesApiComponent);
    fixture.detectChanges();
    await flushTicks();
    http.expectOne(r => new URL(r.url).pathname === '/episodes/outgoing')
      .flush([body(inherits, podId), body(otherPodcast, otherPodId)]);
    await flushTicks();
    fixture.detectChanges();
    return fixture;
  }

  it('re-reads only that podcast\'s cards via GET /episode/{id}, so the inherited flag shows without Refresh', async () => {
    dialog.open.mockReturnValue({ afterClosed: () => of({ updated: true, response: {} }) });
    const fixture = await loadOutgoing();
    const el = fixture.nativeElement as HTMLElement;
    expect(flags(el)).toEqual([null, null]);

    fixture.componentInstance.editPodcast({ podcastName: 'Synthetic Pod', podcastId: podId });
    await flushTicks();
    const refetch = episodeReqs();
    expect(refetch.map(r => [r.request.method, new URL(r.request.url).pathname])).toEqual([['GET', `/episode/${inherits}`]]);
    refetch[0].flush(body(inherits, podId, 'hi'));
    await flushTicks();
    fixture.detectChanges();

    expect(flags(el)).toEqual(['🇮🇳', null]);
    expect(snackBar.open).toHaveBeenCalledWith('Podcast updated', 'Ok', expect.anything());
  });

  it('does not re-read anything when the dialog reports no change', async () => {
    dialog.open.mockReturnValue({ afterClosed: () => of({ noChange: true }) });
    const fixture = await loadOutgoing();
    fixture.componentInstance.editPodcast({ podcastName: 'Synthetic Pod', podcastId: podId });
    await flushTicks();
    expect(episodeReqs().length).toBe(0);
  });
});
