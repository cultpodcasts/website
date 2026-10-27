import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { SiteService } from '../site.service';
import { HeroCurationService } from '../hero-curation.service';
import { EditFilmDialogComponent } from '../edit-film-dialog/edit-film-dialog.component';
import { EpisodesApiComponent } from './episodes-api.component';
import { GuidService } from '../guid.service';

describe('EpisodesApiComponent (embedded)', () => {
  let http: HttpTestingController;
  let site: { setQuery: ReturnType<typeof vi.fn>; setPodcast: ReturnType<typeof vi.fn>; setSubject: ReturnType<typeof vi.fn> };
  let routeParams: BehaviorSubject<Record<string, string>>;
  let getToken: ReturnType<typeof vi.fn>;
  let getHero: ReturnType<typeof vi.fn>;
  let dialog: { open: ReturnType<typeof vi.fn> };
  let snackBar: { open: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    dialog = { open: vi.fn() };
    snackBar = { open: vi.fn() };
    site = { setQuery: vi.fn(), setPodcast: vi.fn(), setSubject: vi.fn() };
    getToken = vi.fn(() => of('tok'));
    getHero = vi.fn(() => Promise.resolve({ episodeIds: [], updatedAt: null }));
    routeParams = new BehaviorSubject<Record<string, string>>({ episodeIds: JSON.stringify(['route-id']) });
    await TestBed.configureTestingModule({
      imports: [EpisodesApiComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: ActivatedRoute, useValue: { params: routeParams } },
        { provide: AuthServiceWrapper, useValue: { roles: of(['Curator']), authService: { getAccessTokenSilently: getToken } } },
        { provide: SiteService, useValue: site },
        { provide: HeroCurationService, useValue: { getHeroCuration: getHero, toggleEpisode: vi.fn() } },
        { provide: MatDialog, useValue: dialog },
        { provide: MatSnackBar, useValue: snackBar },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  const flushTicks = () => new Promise(r => setTimeout(r, 0));

  it('loads the episode ids passed as input instead of the route param, without resetting site state', async () => {
    const fixture = TestBed.createComponent(EpisodesApiComponent);
    fixture.componentRef.setInput('episodeIds', ['e1', 'e2']);
    fixture.componentRef.setInput('embedded', true);
    fixture.componentRef.setInput('heading', 'Ingested episodes');
    fixture.detectChanges();
    await flushTicks();
    const reqs = http.match(r => r.url.includes('/episode/'));
    expect(reqs.map(r => new URL(r.request.url).pathname)).toEqual(['/episode/e1', '/episode/e2']);
    expect(reqs[0].request.headers.get('Authorization')).toBe('Bearer tok');
    expect(site.setQuery).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).querySelector('h2')?.textContent).toBe('Ingested episodes');
    expect((fixture.nativeElement as HTMLElement).querySelector('.curator-toolbar--embedded')).not.toBeNull();
  });

  it('reloads when the input ids change', async () => {
    const fixture = TestBed.createComponent(EpisodesApiComponent);
    fixture.componentRef.setInput('episodeIds', ['e1']);
    fixture.componentRef.setInput('embedded', true);
    fixture.detectChanges();
    await flushTicks();
    http.match(r => r.url.includes('/episode/'));
    fixture.componentRef.setInput('episodeIds', ['e1', 'e3']);
    fixture.detectChanges();
    await flushTicks();
    expect(http.match(r => r.url.includes('/episode/')).map(r => new URL(r.request.url).pathname)).toEqual(['/episode/e1', '/episode/e3']);
  });

  it('still uses the route param on /episodes', async () => {
    const fixture = TestBed.createComponent(EpisodesApiComponent);
    fixture.detectChanges();
    await flushTicks();
    expect(http.match(r => r.url.includes('/episode/')).map(r => new URL(r.request.url).pathname)).toEqual(['/episode/route-id']);
    expect(site.setQuery).toHaveBeenCalledWith(null);
  });

  const episodeReqs = () => http.match(r => r.url.includes('/episode/'));

  it('does not refetch or wipe cards when the parent passes the same ids again (new array)', async () => {
    const fixture = TestBed.createComponent(EpisodesApiComponent);
    fixture.componentRef.setInput('episodeIds', ['e1', 'e2']);
    fixture.componentRef.setInput('embedded', true);
    fixture.detectChanges();
    await flushTicks();
    expect(episodeReqs().length).toBe(2);
    fixture.componentRef.setInput('episodeIds', ['e1', 'e2']);
    fixture.detectChanges();
    await flushTicks();
    expect(episodeReqs().length).toBe(0);
  });

  it('cancels an in-flight load when the ids change, so a stale response cannot win', async () => {
    const fixture = TestBed.createComponent(EpisodesApiComponent);
    fixture.componentRef.setInput('episodeIds', ['old']);
    fixture.componentRef.setInput('embedded', true);
    fixture.detectChanges();
    await flushTicks();
    const [stale] = episodeReqs();
    fixture.componentRef.setInput('episodeIds', ['new']);
    fixture.detectChanges();
    await flushTicks();
    expect(stale.cancelled).toBe(true);
    expect(episodeReqs().map(r => new URL(r.request.url).pathname)).toEqual(['/episode/new']);
  });

  it('cancels the in-flight load on destroy', async () => {
    const fixture = TestBed.createComponent(EpisodesApiComponent);
    fixture.componentRef.setInput('episodeIds', ['e1']);
    fixture.componentRef.setInput('embedded', true);
    fixture.detectChanges();
    await flushTicks();
    const [req] = episodeReqs();
    fixture.destroy();
    expect(req.cancelled).toBe(true);
  });

  it('Refresh on /episodes reloads only the current ids, once per click, without hero refetch or site reset', async () => {
    const fixture = TestBed.createComponent(EpisodesApiComponent);
    fixture.detectChanges();
    await flushTicks();
    episodeReqs();
    for (let click = 0; click < 3; click++) {
      fixture.componentInstance.refresh();
      await flushTicks();
      expect(episodeReqs().map(r => new URL(r.request.url).pathname)).toEqual(['/episode/route-id']);
    }
    expect(getHero).toHaveBeenCalledTimes(1);
    expect(site.setQuery).toHaveBeenCalledTimes(1);
  });

  it('shows the error state and stops the spinner when the token request fails', async () => {
    getToken.mockReturnValue(throwError(() => new Error('login_required')));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(EpisodesApiComponent);
    fixture.componentRef.setInput('episodeIds', ['e1']);
    fixture.componentRef.setInput('embedded', true);
    fixture.detectChanges();
    await flushTicks();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('mat-progress-bar')).toBeNull();
    expect(Array.from(el.querySelectorAll('button')).some(b => b.textContent?.includes('Try again'))).toBe(true);
    expect(episodeReqs().length).toBe(0);
  });

  const filmId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  /** Synthetic GET /episode/{id} body for a film row (RPP #1063: contentKind, slug, path; no parent). */
  const filmRow = {
    id: filmId,
    title: 'One Off',
    description: 'A synthetic film',
    posted: false,
    tweeted: false,
    ignored: false,
    removed: false,
    explicit: false,
    release: '1999-01-01T00:00:00Z',
    duration: '01:42:00',
    subjects: [],
    contentKind: 'Film',
    slug: 'One Off',
    path: '/film/One%20Off/fexample'
  };

  it('a film row gets the curator menu; Edit opens the film dialog (PATCH /film), not the podcast editor, then refreshes the row', async () => {
    dialog.open.mockReturnValue({ afterClosed: () => of({ updated: true, parentName: 'One Off' }) });
    const fixture = TestBed.createComponent(EpisodesApiComponent);
    fixture.componentRef.setInput('episodeIds', [filmId]);
    fixture.componentRef.setInput('embedded', true);
    fixture.detectChanges();
    await flushTicks();
    episodeReqs()[0].flush(filmRow);
    await flushTicks();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.curator-card__overflow')).not.toBeNull();
    // The API path is already encoded; the row link must not encode it again (%2520).
    expect(el.querySelector('mat-card-title a')?.getAttribute('href')).toBe('/film/One%20Off/fexample');
    fixture.componentInstance.editRow({ ...filmRow, release: new Date(filmRow.release) });
    expect(dialog.open).toHaveBeenCalledWith(EditFilmDialogComponent, expect.objectContaining({ data: { filmId } }));
    expect(snackBar.open).toHaveBeenCalledWith('Film updated', 'Ok', expect.anything());
    await flushTicks();
    expect(episodeReqs().map(r => new URL(r.request.url).pathname)).toEqual([`/episode/${filmId}`]);
  });

  it('links each reviewed episode to its page by the short id, never the raw guid', async () => {
    const guid = '00112233-4455-4677-8899-aabbccddeeff';
    const fixture = TestBed.createComponent(EpisodesApiComponent);
    fixture.componentRef.setInput('episodeIds', [guid]);
    fixture.componentRef.setInput('embedded', true);
    fixture.detectChanges();
    await flushTicks();
    http.expectOne(r => r.url.endsWith(`/episode/${guid}`)).flush({
      id: guid, title: 'Synthetic Part', podcastName: 'Synthetic Pod', description: '', posted: false, tweeted: false,
      ignored: false, removed: false, explicit: false, release: '2026-01-02T00:00:00Z', duration: '00:10:00', subjects: [],
    });
    await flushTicks();
    fixture.detectChanges();
    await fixture.whenStable();
    const hrefs = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a[href]')).map(a => a.getAttribute('href') ?? '');
    expect(hrefs).toContain(`/podcast/Synthetic%20Pod/${new GuidService().toBase64(guid)}`);
    expect(hrefs.filter(h => h.includes(guid))).toEqual([]);
  });
  describe('after an edit-podcast save', () => {
    const podId = '11111111-1111-4111-8111-111111111111';
    const otherPodId = '22222222-2222-4222-8222-222222222222';
    const inherits = '33333333-3333-4333-8333-333333333333';
    const ownLanguage = '44444444-4444-4444-8444-444444444444';
    const otherPodcast = '55555555-5555-4555-8555-555555555555';
    const body = (id: string, podcastId: string, lang?: string) => ({
      id, title: `Synthetic ${id.slice(0, 4)}`, podcastId, podcastName: podcastId === podId ? 'Synthetic Pod' : 'Other Pod',
      description: '', posted: false, tweeted: false, ignored: false, removed: false, explicit: false,
      release: '2026-01-02T00:00:00Z', duration: '00:09:18', subjects: [], lang,
    });
    const cardOrder = [inherits, ownLanguage, otherPodcast];
    /** Cards render in id order (forkJoin keeps it); each card's flag after the duration, or null. */
    const flagOf = (el: HTMLElement, id: string) =>
      el.querySelectorAll('mat-card.curator-card')[cardOrder.indexOf(id)]
        ?.querySelector('.curator-card__lang')?.textContent?.trim() ?? null;

    async function loadCards() {
      const fixture = TestBed.createComponent(EpisodesApiComponent);
      fixture.componentRef.setInput('episodeIds', cardOrder);
      fixture.componentRef.setInput('embedded', true);
      fixture.detectChanges();
      await flushTicks();
      const reqs = episodeReqs();
      reqs.find(r => r.request.url.endsWith(inherits))!.flush(body(inherits, podId));
      reqs.find(r => r.request.url.endsWith(ownLanguage))!.flush(body(ownLanguage, podId, 'es'));
      reqs.find(r => r.request.url.endsWith(otherPodcast))!.flush(body(otherPodcast, otherPodId));
      await flushTicks();
      fixture.detectChanges();
      return fixture;
    }

    it('re-reads only that podcast\'s cards, so an inherited default language shows its flag without Refresh', async () => {
      dialog.open.mockReturnValue({ afterClosed: () => of({ updated: true, response: {} }) });
      const fixture = await loadCards();
      const el = fixture.nativeElement as HTMLElement;
      expect(flagOf(el, inherits)).toBeNull();
      expect(flagOf(el, ownLanguage)).toBe('🇪🇸');

      fixture.componentInstance.editPodcast({ podcastName: 'Synthetic Pod', podcastId: podId, episodeId: inherits });
      await flushTicks();
      const refetch = episodeReqs();
      expect(refetch.map(r => new URL(r.request.url).pathname).sort()).toEqual([`/episode/${inherits}`, `/episode/${ownLanguage}`].sort());
      // Server-side propagation moved the inheriting episode to Hindi; the episode with its own language kept it.
      refetch.find(r => r.request.url.endsWith(inherits))!.flush(body(inherits, podId, 'hi'));
      refetch.find(r => r.request.url.endsWith(ownLanguage))!.flush(body(ownLanguage, podId, 'es'));
      await flushTicks();
      fixture.detectChanges();

      expect(flagOf(el, inherits)).toBe('🇮🇳');
      expect(flagOf(el, ownLanguage)).toBe('🇪🇸');
      expect(flagOf(el, otherPodcast)).toBeNull();
      expect(snackBar.open).toHaveBeenCalledWith('Podcast updated', 'Ok', expect.anything());
    });

    it('a failed re-read keeps that card and still updates the others', async () => {
      dialog.open.mockReturnValue({ afterClosed: () => of({ updated: true, response: {} }) });
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const fixture = await loadCards();
      const el = fixture.nativeElement as HTMLElement;
      fixture.componentInstance.editPodcast({ podcastName: 'Synthetic Pod', podcastId: podId });
      await flushTicks();
      const refetch = episodeReqs();
      refetch.find(r => r.request.url.endsWith(inherits))!.flush(body(inherits, podId, 'hi'));
      refetch.find(r => r.request.url.endsWith(ownLanguage))!.flush('boom', { status: 500, statusText: 'Server Error' });
      await flushTicks();
      fixture.detectChanges();
      expect(flagOf(el, inherits)).toBe('🇮🇳');
      expect(flagOf(el, ownLanguage)).toBe('🇪🇸');
      expect(el.querySelectorAll('mat-card.curator-card').length).toBe(3);
    });

    it('does not re-read anything when the dialog reports no change', async () => {
      dialog.open.mockReturnValue({ afterClosed: () => of({ noChange: true }) });
      const fixture = await loadCards();
      fixture.componentInstance.editPodcast({ podcastName: 'Synthetic Pod', podcastId: podId });
      await flushTicks();
      expect(episodeReqs().length).toBe(0);
    });

    it('a re-read landing while a suggested guest is being added does not overwrite that card', async () => {
      dialog.open.mockReturnValue({ afterClosed: () => of({ updated: true, response: {} }) });
      const fixture = TestBed.createComponent(EpisodesApiComponent);
      fixture.componentRef.setInput('episodeIds', [inherits]);
      fixture.componentRef.setInput('embedded', true);
      fixture.detectChanges();
      await flushTicks();
      const guest = { person: { id: 'synthetic-guest', name: 'Synthetic Guest' }, matchResults: [] };
      episodeReqs()[0].flush({ ...body(inherits, podId), guestSuggestions: [guest] });
      await flushTicks();
      fixture.detectChanges();
      const component = fixture.componentInstance;
      const card = () => (component as unknown as { episodes: () => { lang?: string; guestPeople?: { name: string }[] }[] }).episodes()[0];

      component.addSuggestedGuest(card() as never, 'Synthetic Guest');
      await flushTicks();
      const patch = http.expectOne(r => r.method === 'PATCH');
      component.editPodcast({ podcastName: 'Synthetic Pod', podcastId: podId });
      await flushTicks();
      // The podcast re-read lands first, without the guest: the card keeps the in-flight guest.
      http.expectOne(r => r.method === 'GET' && r.url.endsWith(`/episode/${inherits}`)).flush(body(inherits, podId, 'hi'));
      await flushTicks();
      expect(card().guestPeople?.map(x => x.name)).toEqual(['Synthetic Guest']);

      // The guest save's own GET then binds the server state (guest + inherited language).
      patch.flush(null);
      await flushTicks();
      http.expectOne(r => r.method === 'GET' && r.url.endsWith(`/episode/${inherits}`))
        .flush({ ...body(inherits, podId, 'hi'), guestPeople: [guest.person] });
      await flushTicks();
      fixture.detectChanges();
      expect(card().guestPeople?.map(x => x.name)).toEqual(['Synthetic Guest']);
      expect(card().lang).toBe('hi');
    });
  });
});
