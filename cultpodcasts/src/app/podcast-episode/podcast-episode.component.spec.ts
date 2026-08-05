import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, of } from 'rxjs';
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
  const routeParams = new BehaviorSubject<{ podcastName: string }>({
    podcastName: 'Show A',
  });

  beforeEach(async () => {
    originalImage = globalThis.Image;
    globalThis.Image = ImmediateImage as unknown as typeof Image;

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
            getEntities: () => of({ entities: [] }),
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
});
