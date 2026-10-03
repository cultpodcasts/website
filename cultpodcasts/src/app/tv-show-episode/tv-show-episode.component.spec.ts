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
import { EditTvShowEpisodeCanonicalDialogComponent } from '../edit-tv-show-episode-canonical-dialog/edit-tv-show-episode-canonical-dialog.component';
import { EpisodeService } from '../episode.service';
import { GuidService } from '../guid.service';
import { ODataService } from '../odata.service';
import { PlayerService } from '../player.service';
import { PodcastEpisodeComponent } from '../podcast-episode/podcast-episode.component';
import { ProfileService } from '../profile.service';
import { SearchResult } from '../search-result.interface';
import { SeoService } from '../seo.service';
import { SiteService } from '../site.service';
import { TvShowEpisodeComponent } from './tv-show-episode.component';

const id = '00112233-4455-4677-8899-aabbccddeeff';

function tvHit(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id,
    podcastName: 'Nightly',
    episodeTitle: 'Part',
    episodeDescription: 'Desc',
    release: new Date('2026-01-02T00:00:00Z'),
    duration: '01:00:00',
    contentKind: 'TvShowEpisode',
    ...overrides,
  };
}

describe('TvShowEpisodeComponent', () => {
  describe('editIdentity', () => {
    let fixture: ComponentFixture<TvShowEpisodeComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [TvShowEpisodeComponent],
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

      fixture = TestBed.createComponent(TvShowEpisodeComponent);
      fixture.detectChanges();
    });

    it('opens the identity dialog with identity-only options', () => {
      const open = TestBed.inject(MatDialog).open as ReturnType<typeof vi.fn>;
      open.mockReturnValue({ afterClosed: () => of(undefined) });

      fixture.componentInstance.editIdentity('ep-tv');

      expect(open).toHaveBeenCalledWith(
        EditTvShowEpisodeCanonicalDialogComponent,
        expect.objectContaining({ data: { episodeId: 'ep-tv' } })
      );
    });
  });

  describe('playable curator edit binding', () => {
    const guids = new GuidService();

    it('opens the identity dialog from child edit() through the TV shell, not the podcast editor', async () => {
      const shortId = guids.toCatalogueShortId(id, 'TvShowEpisode');
      const params = { slug: 'Nightly', query: shortId };
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [TvShowEpisodeComponent],
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
              GetEpisodeDetailsFromApi: async () => tvHit(),
              getPlayableById: async () => undefined,
            },
          },
          { provide: SeoService, useValue: { AddMetaTags: () => undefined } },
        ],
      }).compileComponents();

      const router = TestBed.inject(Router);
      Object.defineProperty(router, 'url', {
        configurable: true,
        get: () => `/tv/${encodeURIComponent('Nightly')}/${shortId}`,
      });
      vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

      const fixture = TestBed.createComponent(TvShowEpisodeComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve, 0));
      fixture.detectChanges();

      const child = fixture.debugElement.query(By.directive(PodcastEpisodeComponent));
      expect(child).toBeTruthy();
      expect(child.componentInstance.emitCuratorEdit).toBe(true);

      const open = TestBed.inject(MatDialog).open as ReturnType<typeof vi.fn>;
      open.mockReturnValue({ afterClosed: () => of(undefined) });

      child.componentInstance.edit('Nightly', id);

      expect(open).toHaveBeenCalledWith(
        EditTvShowEpisodeCanonicalDialogComponent,
        expect.objectContaining({ data: { episodeId: id } })
      );
      expect(open).not.toHaveBeenCalledWith(
        EditEpisodeDialogComponent,
        expect.anything()
      );
    });
  });
});
