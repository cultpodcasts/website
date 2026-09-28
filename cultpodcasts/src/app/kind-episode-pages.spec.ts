import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID, provideZonelessChangeDetection, RESPONSE_INIT, Type } from '@angular/core';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { FilmPageComponent } from './film-page/film-page.component';
import { TvShowEpisodeComponent } from './tv-show-episode/tv-show-episode.component';
import { NewsReportComponent } from './news-report/news-report.component';
import { routes } from './app.routes';
import { GuidService } from './guid.service';
import { EpisodeService } from './episode.service';
import { SeoService } from './seo.service';
import { SearchResult } from './search-result.interface';

const id = '00112233-4455-4677-8899-aabbccddeeff';

function hit(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id,
    podcastName: 'Nightly',
    episodeTitle: 'One Off',
    episodeDescription: 'Desc',
    release: new Date('2026-01-02T00:00:00Z'),
    duration: '01:00:00',
    ...overrides,
  };
}

describe('kind episode pages', () => {
  const guids = new GuidService();

  async function render<T>(
    component: Type<T>,
    options: {
      path: string;
      params: Record<string, string>;
      episode?: SearchResult;
      platform?: string;
      responseInit?: { status?: number; headers: Headers };
    }
  ): Promise<{ fixture: ComponentFixture<T>; lookedUp: string[]; nav: ReturnType<typeof vi.spyOn> }> {
    const lookedUp: string[] = [];
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [component],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter(routes),
        GuidService,
        { provide: PLATFORM_ID, useValue: options.platform ?? 'browser' },
        {
          provide: ActivatedRoute,
          useValue: {
            params: of(options.params),
            snapshot: { params: options.params },
          },
        },
        ...(options.responseInit ? [{ provide: RESPONSE_INIT, useValue: options.responseInit }] : []),
        {
          provide: EpisodeService,
          useValue: {
            getEpisodeDetailsFromKvViaApi: async () => undefined,
            GetEpisodeDetailsFromApi: async (episodeId: string) => {
              lookedUp.push(episodeId);
              return options.episode;
            },
            getPlayableById: async () => undefined,
          },
        },
        { provide: SeoService, useValue: { AddMetaTags: () => undefined } },
      ],
    }).compileComponents();

    const router = TestBed.inject(Router);
    Object.defineProperty(router, 'url', { configurable: true, get: () => options.path });
    const nav = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(component);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    return { fixture, lookedUp, nav };
  }

  it('keeps the loading shell up while an old unprefixed id leaves for its film', async () => {
    const shortId = guids.toBase64(id);
    const { fixture, lookedUp, nav } = await render(FilmPageComponent, {
      path: `/podcast/${encodeURIComponent('Old Show')}/${shortId}`,
      params: { slug: 'Old Show', query: shortId },
      episode: hit({ contentKind: 'Film', podcastName: '', episodeTitle: 'One Off' }),
    });

    expect(lookedUp).toEqual([id]);
    expect(String(nav.mock.calls[0][0])).toBe(`/film/${encodeURIComponent('One Off')}/${guids.toCatalogueShortId(id, 'Film')}`);
    expect(fixture.nativeElement.querySelector('[aria-label="Loading episode"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).not.toContain('Episode not found');
    expect(fixture.nativeElement.querySelector('a.hero-pill')).toBeNull();
  });

  it('shows a film with no parent line once the path already matches', async () => {
    const shortId = guids.toCatalogueShortId(id, 'Film');
    const { fixture, nav } = await render(FilmPageComponent, {
      path: `/film/${encodeURIComponent('One Off')}/${shortId}`,
      params: { slug: 'One Off', query: shortId },
      episode: hit({ contentKind: 'Film', podcastName: 'Studio', episodeTitle: 'One Off' }),
    });

    expect(nav).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('One Off');
    expect(fixture.nativeElement.querySelector('a.hero-pill')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Studio');
  });

  it('points a TV episode parent at /tv/ and does not flash not found during a move', async () => {
    const responseInit: { status?: number; headers: Headers } = { headers: new Headers() };
    const legacy = guids.toBase64(id);
    const moving = await render(TvShowEpisodeComponent, {
      path: `/podcast/Old%20Show/${legacy}`,
      params: { slug: 'Old Show', query: legacy },
      episode: hit({ contentKind: 'TvShowEpisode', podcastName: 'Nightly', episodeTitle: 'Part' }),
      platform: 'server',
      responseInit,
    });
    expect(responseInit.status).toBe(301);
    expect(responseInit.headers.get('Location')).toBe(`/tv/${encodeURIComponent('Nightly')}/${guids.toCatalogueShortId(id, 'TvShowEpisode')}`);
    expect(moving.fixture.nativeElement.textContent).not.toContain('Episode not found');

    const shortId = guids.toCatalogueShortId(id, 'TvShowEpisode');
    const stayed = await render(TvShowEpisodeComponent, {
      path: `/tv/${encodeURIComponent('Nightly')}/${shortId}`,
      params: { slug: 'Nightly', query: shortId },
      episode: hit({ contentKind: 'TvShowEpisode', podcastName: 'Nightly', episodeTitle: 'Part' }),
    });
    const pill = stayed.fixture.nativeElement.querySelector('a.hero-pill') as HTMLAnchorElement;
    expect(pill.getAttribute('href')).toBe('/tv/Nightly');
    expect(pill.textContent?.trim()).toBe('Nightly');
  });

  it('opens a film from the raw guid a card puts in the path, then uses the prefixed short id', async () => {
    const { fixture, lookedUp, nav } = await render(FilmPageComponent, {
      path: `/film/${encodeURIComponent('One Off')}/${id}`,
      params: { slug: 'One Off', query: id },
      episode: hit({ contentKind: 'Film', podcastName: '', episodeTitle: 'One Off' }),
    });

    expect(lookedUp).toEqual([id]);
    expect(String(nav.mock.calls[0][0])).toBe(`/film/${encodeURIComponent('One Off')}/${guids.toCatalogueShortId(id, 'Film')}`);
    expect(fixture.nativeElement.querySelector('[aria-label="Loading episode"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).not.toContain('Episode not found');
    expect(fixture.nativeElement.querySelector('a.hero-pill')).toBeNull();
  });

  it('points a news report parent at /news/ and does not flash not found during a move', async () => {
    const responseInit: { status?: number; headers: Headers } = { headers: new Headers() };
    const legacy = guids.toBase64(id);
    const moving = await render(NewsReportComponent, {
      path: `/podcast/Old%20Desk/${legacy}`,
      params: { slug: 'Old Desk', query: legacy },
      episode: hit({ contentKind: 'NewsReport', podcastName: 'Desk', episodeTitle: 'Bulletin' }),
      platform: 'server',
      responseInit,
    });
    expect(responseInit.status).toBe(301);
    expect(responseInit.headers.get('Location')).toBe(`/news/${encodeURIComponent('Desk')}/${guids.toCatalogueShortId(id, 'NewsReport')}`);
    expect(moving.fixture.nativeElement.textContent).not.toContain('Episode not found');

    const shortId = guids.toCatalogueShortId(id, 'NewsReport');
    const stayed = await render(NewsReportComponent, {
      path: `/news/${encodeURIComponent('Desk')}/${shortId}`,
      params: { slug: 'Desk', query: shortId },
      episode: hit({ contentKind: 'NewsReport', podcastName: 'Desk', episodeTitle: 'Bulletin' }),
    });
    const pill = stayed.fixture.nativeElement.querySelector('a.hero-pill') as HTMLAnchorElement;
    expect(pill.getAttribute('href')).toBe('/news/Desk');
    expect(pill.textContent?.trim()).toBe('Desk');
    expect(stayed.fixture.nativeElement.textContent).toContain('Bulletin');
  });

  it('sends a missing news report back to the organisation hub', async () => {
    const shortId = guids.toCatalogueShortId(id, 'NewsReport');
    const { fixture } = await render(NewsReportComponent, {
      path: `/news/${encodeURIComponent('Desk')}/${shortId}`,
      params: { slug: 'Desk', query: shortId },
    });
    expect(fixture.nativeElement.textContent).toContain('Episode not found');
    const link = fixture.nativeElement.querySelector('#cta-button a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/news/Desk');
  });
});
