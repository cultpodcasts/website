import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { PodcastEpisodeComponent } from './podcast-episode.component';
import { SearchResult } from '../search-result.interface';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { SiteService } from '../site.service';
import { ODataService } from '../odata.service';
import { PlayerService } from '../player.service';
import { ProfileService } from '../profile.service';

function ep(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: 'ep-a',
    podcastName: 'Show A',
    episodeTitle: 'Episode A',
    episodeDescription: 'Desc A',
    release: new Date('2026-07-31T12:00:00Z'),
    duration: '01:06:12',
    youtubeId: 'abc123',
    subjects: ['Subject A'],
    image: 'https://img.example/a.jpg',
    ...overrides,
  };
}

/** Image that is already decoded when `src` is assigned (cache hit). */
class ImmediateImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  complete = false;
  naturalWidth = 1280;
  naturalHeight = 720;
  decoding = '';
  set src(_value: string) {
    this.complete = true;
  }
}

describe('PodcastEpisodeComponent', () => {
  let fixture: ComponentFixture<PodcastEpisodeComponent>;
  let originalImage: typeof Image;
  let getEntities: ReturnType<typeof vi.fn>;
  const routeParams = new BehaviorSubject<{ podcastName: string }>({
    podcastName: 'Show A',
  });

  beforeEach(async () => {
    originalImage = globalThis.Image;
    globalThis.Image = ImmediateImage as unknown as typeof Image;
    getEntities = vi.fn(() => of({ entities: [] as SearchResult[] }));

    await TestBed.configureTestingModule({
      imports: [PodcastEpisodeComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: ActivatedRoute,
          useValue: {
            params: routeParams.asObservable(),
            queryParams: of({}),
          },
        },
        {
          provide: AuthServiceWrapper,
          useValue: {
            roles: of([] as string[]),
            isSignedIn: of(false),
          },
        },
        {
          provide: SiteService,
          useValue: {
            setQuery: () => undefined,
            setPodcast: () => undefined,
            setSubject: () => undefined,
          },
        },
        {
          provide: ODataService,
          useValue: {
            getEntities,
          },
        },
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
          useValue: {
            isAuthenticated$: of(false),
            bookmarks$: of(new Set<string>()),
          },
        },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PodcastEpisodeComponent);
    fixture.componentRef.setInput('episode', ep());
    fixture.componentRef.setInput('parentLoaded', true);
    fixture.detectChanges();
  });

  afterEach(() => {
    globalThis.Image = originalImage;
  });

  function query(selector: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(selector);
  }

  it('places a podcast pill above the title, then date and duration in the meta line', () => {
    const pill = query('a.hero-pill') as HTMLAnchorElement | null;
    const title = query('h1.episode-hero__title');
    const meta = query('.hero-meta');
    expect(pill).toBeTruthy();
    expect(title).toBeTruthy();
    expect(meta).toBeTruthy();

    const metaText = meta!.textContent?.replace(/\s+/g, ' ').trim();

    expect(query('.billboard__eyebrow')).toBeNull();
    expect(pill!.textContent?.trim()).toBe('Show A');
    expect(pill!.getAttribute('href')).toBe('/podcast/Show%20A');
    expect(title!.textContent?.trim()).toBe('Episode A');
    expect(metaText).toContain('31 Jul 2026');
    expect(metaText).toContain('1:06:12');
    expect(meta!.querySelector('a')).toBeNull();
    expect(pill!.compareDocumentPosition(title!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(title!.compareDocumentPosition(meta!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('omits the release date from the meta line when the episode has no usable release', () => {
    fixture.componentRef.setInput('episode', ep({ release: new Date('not-a-date') }));
    fixture.detectChanges();

    const meta = query('.hero-meta');
    expect(meta?.querySelector('.hero-meta__dot')).toBeNull();
    expect(meta?.textContent?.replace(/\s+/g, ' ').trim()).toBe('1:06:12');
  });

  function rails(): {
    morePodcastEpisodes(): SearchResult[];
    subjectRails(): { subject: string; episodes: SearchResult[] }[];
  } {
    return fixture.componentInstance as unknown as {
      morePodcastEpisodes(): SearchResult[];
      subjectRails(): { subject: string; episodes: SearchResult[] }[];
    };
  }

  function rawHit(fields: Partial<SearchResult> & { title?: string; seriesName?: string; description?: string }): SearchResult {
    return {
      id: 'other',
      podcastName: '',
      episodeTitle: '',
      episodeDescription: '',
      release: new Date('2026-07-31T12:00:00Z'),
      duration: '00:10:00',
      ...fields,
    };
  }

  it('loads More from with seriesName and normalizes both related rails', () => {
    const filters: string[] = [];
    getEntities.mockImplementation((_url: string, request: { filter: string }) => {
      filters.push(request.filter);
      if (request.filter.includes('seriesName')) {
        return of({
          entities: [rawHit({ id: 'more', title: 'More title', seriesName: 'Show A', description: 'More blurb' })],
        });
      }
      return of({
        entities: [rawHit({ id: 'subject-hit', title: 'Subject title', seriesName: 'Other show', description: 'Subject blurb' })],
      });
    });

    fixture.componentRef.setInput('episode', ep({ id: 'ep-b', subjects: ['Subject A'] }));
    fixture.detectChanges();

    expect(filters.some((filter) => filter.includes("(seriesName eq 'Show A')"))).toBe(true);
    expect(filters.some((filter) => filter.includes('podcastName'))).toBe(false);
    expect(rails().morePodcastEpisodes()[0].episodeTitle).toBe('More title');
    expect(rails().morePodcastEpisodes()[0].podcastName).toBe('Show A');
    expect(rails().morePodcastEpisodes()[0].episodeDescription).toBe('More blurb');
    expect(rails().subjectRails()[0].episodes[0].episodeTitle).toBe('Subject title');
    expect(rails().subjectRails()[0].episodes[0].podcastName).toBe('Other show');
  });

  it('retries More from with podcastName once when seriesName is an unknown field', () => {
    const filters: string[] = [];
    getEntities.mockImplementation((_url: string, request: { filter: string }) => {
      filters.push(request.filter);
      if (request.filter.includes('seriesName')) {
        return throwError(() => new HttpErrorResponse({ status: 400, statusText: 'Bad Request', error: {} }));
      }
      if (request.filter.includes('podcastName')) {
        return of({ entities: [rawHit({ id: 'more', episodeTitle: 'Live title', podcastName: 'Show A' })] });
      }
      return of({ entities: [] });
    });

    fixture.componentRef.setInput('episode', ep({ id: 'ep-c', subjects: [] }));
    fixture.detectChanges();

    expect(filters.filter((filter) => filter.includes('seriesName'))).toHaveLength(1);
    expect(filters.filter((filter) => filter.includes('podcastName'))).toHaveLength(1);
    expect(rails().morePodcastEpisodes()[0].episodeTitle).toBe('Live title');
  });

  it('does not retry More from after a non-field error', () => {
    const filters: string[] = [];
    getEntities.mockImplementation((_url: string, request: { filter: string }) => {
      filters.push(request.filter);
      return throwError(() => new HttpErrorResponse({ status: 500, statusText: 'Server Error', error: { message: 'timeout' } }));
    });

    fixture.componentRef.setInput('episode', ep({ id: 'ep-d', subjects: [] }));
    fixture.detectChanges();

    expect(filters).toHaveLength(1);
    expect(filters[0]).toContain('seriesName');
    expect(rails().morePodcastEpisodes()).toEqual([]);
  });
});
