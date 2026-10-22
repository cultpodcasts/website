import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { routes } from '../app.routes';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { EditEpisodeDialogComponent } from '../edit-episode-dialog/edit-episode-dialog.component';
import { EditFilmDialogComponent } from '../edit-film-dialog/edit-film-dialog.component';
import { EpisodeService } from '../episode.service';
import { GuidService } from '../guid.service';
import { ODataService } from '../odata.service';
import { PlayerService } from '../player.service';
import { PodcastEpisodeComponent } from '../podcast-episode/podcast-episode.component';
import { ProfileService } from '../profile.service';
import { SearchResult } from '../search-result.interface';
import { SeoService } from '../seo.service';
import { SiteService } from '../site.service';
import { FilmPageComponent } from './film-page.component';
import { FilmTrailersComponent } from '../film-trailers/film-trailers.component';

const id = '00112233-4455-4677-8899-aabbccddeeff';

function filmHit(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id,
    podcastName: 'One Off',
    episodeTitle: 'One Off',
    episodeDescription: 'Desc',
    release: new Date('2026-01-02T00:00:00Z'),
    duration: '01:00:00',
    contentKind: 'Film',
    ...overrides,
  };
}

describe('FilmPageComponent', () => {
  describe('editFilm', () => {
    let fixture: ComponentFixture<FilmPageComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [FilmPageComponent],
        providers: [
          provideZonelessChangeDetection(),
          provideRouter([]),
          { provide: PLATFORM_ID, useValue: 'browser' },
          { provide: GuidService, useValue: { parseCatalogueShortId: () => null, getEpisodeUuid: () => '' } },
          { provide: SeoService, useValue: { AddMetaTags: () => undefined } },
          { provide: EpisodeService, useValue: { GetEpisodeDetailsFromApi: async () => undefined, getPlayableById: async () => undefined } },
          { provide: MatDialog, useValue: { open: vi.fn() } },
          { provide: MatSnackBar, useValue: { open: vi.fn() } },
        ],
      }).compileComponents();

      fixture = TestBed.createComponent(FilmPageComponent);
      fixture.detectChanges();
    });

    it('opens the film dialog for the film id', () => {
      const open = TestBed.inject(MatDialog).open as ReturnType<typeof vi.fn>;
      open.mockReturnValue({ afterClosed: () => of(undefined) });

      fixture.componentInstance.editFilm('ep-film');

      expect(open).toHaveBeenCalledWith(
        EditFilmDialogComponent,
        expect.objectContaining({ data: { filmId: 'ep-film' } })
      );
    });
  });

  describe('playable curator edit binding', () => {
    const guids = new GuidService();

    it('renders the shared episode shell and opens the film dialog from its Edit, not the podcast editor', async () => {
      const shortId = guids.toCatalogueShortId(id, 'Film');
      const params = { slug: 'One Off', query: shortId };
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [FilmPageComponent],
        providers: [
          provideZonelessChangeDetection(),
          provideRouter(routes),
          GuidService,
          { provide: PLATFORM_ID, useValue: 'browser' },
          {
            provide: ActivatedRoute,
            useValue: {
              params: of(params),
              queryParams: of({}),
              snapshot: { params },
            },
          },
          {
            provide: AuthServiceWrapper,
            useValue: { roles: of([] as string[]), isSignedIn: of(false) },
          },
          {
            provide: SiteService,
            useValue: {
              setQuery: () => undefined,
              setPodcast: () => undefined,
              setSubject: () => undefined,
            },
          },
          { provide: ODataService, useValue: { getEntities: () => of({ entities: [] as SearchResult[] }) } },
          {
            provide: PlayerService,
            useValue: {
              episode: () => undefined,
              mode: () => 'dock',
              play: () => undefined,
              isQueuedId: () => false,
              queuedKeys: () => new Set<string>(),
              toggleQueue: () => undefined,
            },
          },
          {
            provide: ProfileService,
            useValue: { isAuthenticated$: of(false), bookmarks$: of(new Set<string>()) },
          },
          { provide: MatDialog, useValue: { open: vi.fn() } },
          { provide: MatSnackBar, useValue: { open: vi.fn() } },
          {
            provide: EpisodeService,
            useValue: {
              getEpisodeDetailsFromKvViaApi: async () => undefined,
              GetEpisodeDetailsFromApi: async () => filmHit({
                trailers: ['00:02:11|https://www.youtube.com/watch?v=synthetic01|Synthetic Teaser'],
              }),
              getPlayableById: async () => undefined,
            },
          },
          { provide: SeoService, useValue: { AddMetaTags: () => undefined } },
        ],
      }).compileComponents();

      const router = TestBed.inject(Router);
      Object.defineProperty(router, 'url', {
        configurable: true,
        get: () => `/film/${encodeURIComponent('One Off')}/${shortId}`,
      });
      vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

      const fixture = TestBed.createComponent(FilmPageComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve, 0));
      fixture.detectChanges();

      const child = fixture.debugElement.query(By.directive(PodcastEpisodeComponent));
      expect(child).toBeTruthy();
      const trailers = fixture.debugElement.query(By.directive(FilmTrailersComponent));
      expect(trailers.componentInstance.trailers()).toEqual([
        '00:02:11|https://www.youtube.com/watch?v=synthetic01|Synthetic Teaser',
      ]);
      expect(trailers.componentInstance.filmId()).toBe(id);
      // Projected into the shell, under the hero, as a rail card.
      const shell = child.nativeElement as HTMLElement;
      const rail = shell.querySelector('section.episode app-film-trailers app-episode-rail');
      expect(rail?.querySelector('.rail__title')?.textContent?.trim()).toBe('Trailers');
      expect(rail?.querySelectorAll('app-film-trailer-card').length).toBe(1);
      expect(child.componentInstance.emitCuratorEdit).toBe(true);

      const open = TestBed.inject(MatDialog).open as ReturnType<typeof vi.fn>;
      open.mockReturnValue({ afterClosed: () => of(undefined) });

      child.componentInstance.edit('One Off', id);

      expect(open).toHaveBeenCalledWith(
        EditFilmDialogComponent,
        expect.objectContaining({ data: { filmId: id } })
      );
      expect(open).not.toHaveBeenCalledWith(
        EditEpisodeDialogComponent,
        expect.anything()
      );
    });
  });
});
