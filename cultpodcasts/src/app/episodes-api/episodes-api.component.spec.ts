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
});
