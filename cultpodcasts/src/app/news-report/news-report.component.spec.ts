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
import { EditNewsReportDialogComponent } from '../edit-news-report-dialog/edit-news-report-dialog.component';
import { EpisodeService } from '../episode.service';
import { GuidService } from '../guid.service';
import { ODataService } from '../odata.service';
import { PlayerService } from '../player.service';
import { PodcastEpisodeComponent } from '../podcast-episode/podcast-episode.component';
import { ProfileService } from '../profile.service';
import { SearchResult } from '../search-result.interface';
import { SeoService } from '../seo.service';
import { SiteService } from '../site.service';
import { NewsReportComponent } from './news-report.component';

const id = '00112233-4455-4677-8899-aabbccddeeff';

function newsHit(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id,
    podcastName: 'Desk',
    episodeTitle: 'Bulletin',
    episodeDescription: 'Desc',
    release: new Date('2026-01-02T00:00:00Z'),
    duration: '01:00:00',
    contentKind: 'NewsReport',
    ...overrides,
  };
}

describe('NewsReportComponent', () => {
  describe('editReport', () => {
    let fixture: ComponentFixture<NewsReportComponent>;

    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [NewsReportComponent],
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

      fixture = TestBed.createComponent(NewsReportComponent);
      fixture.detectChanges();
    });

    it('opens the news report dialog for the report id', () => {
      const open = TestBed.inject(MatDialog).open as ReturnType<typeof vi.fn>;
      open.mockReturnValue({ afterClosed: () => of(undefined) });

      fixture.componentInstance.editReport('ep-news');

      expect(open).toHaveBeenCalledWith(
        EditNewsReportDialogComponent,
        expect.objectContaining({ data: { reportId: 'ep-news' } })
      );
    });
  });

  describe('playable curator edit binding', () => {
    const guids = new GuidService();

    it('opens the news report dialog from child edit() through the news shell, not the podcast editor', async () => {
      const shortId = guids.toCatalogueShortId(id, 'NewsReport');
      const params = { slug: 'Desk', query: shortId };
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [NewsReportComponent],
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
              GetEpisodeDetailsFromApi: async () => newsHit(),
              getPlayableById: async () => undefined,
            },
          },
          { provide: SeoService, useValue: { AddMetaTags: () => undefined } },
        ],
      }).compileComponents();

      const router = TestBed.inject(Router);
      Object.defineProperty(router, 'url', {
        configurable: true,
        get: () => `/news/${encodeURIComponent('Desk')}/${shortId}`,
      });
      vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

      const fixture = TestBed.createComponent(NewsReportComponent);
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve, 0));
      fixture.detectChanges();

      const child = fixture.debugElement.query(By.directive(PodcastEpisodeComponent));
      expect(child).toBeTruthy();
      expect(child.componentInstance.emitCuratorEdit).toBe(true);

      const open = TestBed.inject(MatDialog).open as ReturnType<typeof vi.fn>;
      open.mockReturnValue({ afterClosed: () => of(undefined) });

      child.componentInstance.edit('Desk', id);

      expect(open).toHaveBeenCalledWith(
        EditNewsReportDialogComponent,
        expect.objectContaining({ data: { reportId: id } })
      );
      expect(open).not.toHaveBeenCalledWith(
        EditEpisodeDialogComponent,
        expect.anything()
      );
    });
  });
});
