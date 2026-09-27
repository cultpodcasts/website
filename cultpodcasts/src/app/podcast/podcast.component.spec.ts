import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID, provideZonelessChangeDetection, RESPONSE_INIT } from '@angular/core';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { routes } from '../app.routes';
import { PodcastComponent } from './podcast.component';
import { GuidService } from '../guid.service';
import { EpisodeService } from '../episode.service';
import { SeoService } from '../seo.service';
import { SearchResult } from '../search-result.interface';
import { ODataService } from '../odata.service';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { SiteService } from '../site.service';
import { PlayerService } from '../player.service';
import { ProfileService } from '../profile.service';
import { IPageDetails } from '../page-details.interface';

const id = '00112233-4455-4677-8899-aabbccddeeff';

function hit(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id,
    podcastName: 'Old Show',
    episodeTitle: 'One Off',
    episodeDescription: 'Desc',
    release: new Date('2026-01-02T00:00:00Z'),
    duration: '01:00:00',
    ...overrides,
  };
}

describe('PodcastComponent', () => {
  const guids = new GuidService();

  async function render(options: {
    path: string;
    params: Record<string, string>;
    root: string;
    episode?: SearchResult;
    platform?: string;
    responseInit?: { status?: number; headers?: HeadersInit };
  }): Promise<{
    fixture: ComponentFixture<PodcastComponent>;
    lookedUp: string[];
    titles: string[];
    nav: ReturnType<typeof vi.spyOn>;
  }> {
    const lookedUp: string[] = [];
    const titles: string[] = [];
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [PodcastComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter(routes),
        GuidService,
        {
          provide: ActivatedRoute,
          useValue: {
            params: of(options.params),
            queryParams: of({}),
            snapshot: {
              params: options.params,
              url: [{ path: options.root }],
            },
          },
        },
        { provide: PLATFORM_ID, useValue: options.platform ?? 'browser' },
        ...(options.responseInit ? [{ provide: RESPONSE_INIT, useValue: options.responseInit }] : []),
        {
          provide: EpisodeService,
          useValue: {
            getEpisodeDetailsFromKvViaApi: async () => undefined,
            GetEpisodeDetailsFromApi: async (episodeId: string) => {
              lookedUp.push(episodeId);
              return options.episode;
            },
            getPlayableById: async () => options.episode,
          },
        },
        {
          provide: SeoService,
          useValue: {
            AddMetaTags: (details: IPageDetails) => {
              if (details.title) {
                titles.push(details.title);
              }
            },
          },
        },
        { provide: ODataService, useValue: { getEntities: () => of({ entities: [] }) } },
        { provide: AuthServiceWrapper, useValue: { roles: of([]), isSignedIn: of(false) } },
        { provide: SiteService, useValue: { setQuery: () => undefined, setPodcast: () => undefined, setSubject: () => undefined } },
        { provide: PlayerService, useValue: { episode: () => undefined, mode: () => 'dock', play: () => undefined, isQueuedId: () => false, queuedKeys: () => new Set<string>(), toggleQueue: () => undefined } },
        { provide: ProfileService, useValue: { isAuthenticated$: of(false), bookmarks$: of(new Set<string>()) } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    }).compileComponents();

    const router = TestBed.inject(Router);
    await router.navigateByUrl(options.path);
    const nav = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(PodcastComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    return { fixture, lookedUp, titles, nav };
  }

  it('keeps the loading shell up while an old unprefixed id leaves for its film', async () => {
    const shortId = guids.toBase64(id);
    const { fixture, lookedUp, nav } = await render({
      path: `/podcast/${encodeURIComponent('Old Show')}/${shortId}`,
      params: { podcastName: 'Old Show', query: shortId },
      root: 'podcast',
      episode: hit({ contentKind: 'Film', podcastName: '', episodeTitle: 'One Off' }),
    });

    expect(lookedUp).toEqual([id]);
    expect(nav).toHaveBeenCalledTimes(1);
    expect(String(nav.mock.calls[0][0])).toBe(`/film/${encodeURIComponent('One Off')}/${guids.toCatalogueShortId(id, 'Film')}`);
    expect((fixture.componentInstance as unknown as { isLoading(): boolean }).isLoading()).toBe(true);
    expect(fixture.nativeElement.querySelector('[aria-label="Loading episode"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).not.toContain('Episode not found');
  });

  it('sends a moved TV episode to /tv/ on the server and leaves a podcast episode on /podcast/', async () => {
    const responseInit: { status?: number; headers: Headers } = { headers: new Headers() };
    const shortId = guids.toBase64(id);
    const moved = await render({
      path: `/podcast/${encodeURIComponent('Old Show')}/${shortId}`,
      params: { podcastName: 'Old Show', query: shortId },
      root: 'podcast',
      episode: hit({ contentKind: 'TvShowEpisode', podcastName: 'Nightly', episodeTitle: 'Part' }),
      platform: 'server',
      responseInit,
    });

    expect(moved.lookedUp).toEqual([id]);
    expect(moved.nav).not.toHaveBeenCalled();
    expect(responseInit.status).toBe(301);
    expect(responseInit.headers.get('Location')).toBe(`/tv/${encodeURIComponent('Nightly')}/${guids.toCatalogueShortId(id, 'TvShowEpisode')}`);
    expect(moved.titles.some((title) => title.includes('Nightly'))).toBe(true);
    expect(moved.titles.some((title) => title.includes('Old Show'))).toBe(false);
    expect(moved.fixture.nativeElement.textContent).not.toContain('Episode not found');

    const stayed = await render({
      path: `/podcast/${encodeURIComponent('Show')}/${shortId}`,
      params: { podcastName: 'Show', query: shortId },
      root: 'podcast',
      episode: hit({ contentKind: 'Episode', podcastName: 'Show', episodeTitle: 'Part' }),
    });
    expect(stayed.nav).not.toHaveBeenCalled();
    expect(stayed.fixture.nativeElement.textContent).not.toContain('Episode not found');
    expect(stayed.fixture.nativeElement.textContent).toContain('Part');
  });

  it('points a missing TV episode at /tv/ and does not offer a film hub', async () => {
    const shortId = guids.toBase64(id);
    const tv = await render({
      path: `/tv/${encodeURIComponent('Nightly')}/${shortId}`,
      params: { slug: 'Nightly', query: shortId },
      root: 'tv',
    });
    const tvLink = tv.fixture.nativeElement.querySelector('#cta-button a') as HTMLAnchorElement | null;
    expect(tv.fixture.nativeElement.textContent).toContain('Episode not found');
    expect(tvLink?.getAttribute('href')).toBe('/tv/Nightly');

    const film = await render({
      path: `/film/${encodeURIComponent('One Off')}/${shortId}`,
      params: { slug: 'One Off', query: shortId },
      root: 'film',
    });
    expect(film.fixture.nativeElement.textContent).toContain('Episode not found');
    expect(film.fixture.nativeElement.querySelector('#cta-button')).toBeNull();
    expect(film.fixture.nativeElement.textContent).not.toContain("Try the Podcast's page");
  });
});
