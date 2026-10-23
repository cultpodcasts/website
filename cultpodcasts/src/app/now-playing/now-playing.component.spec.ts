import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { NowPlayingComponent } from './now-playing.component';
import { PlayerService } from '../player.service';
import { SearchResult } from '../search-result.interface';
import { GuidService } from '../guid.service';
import { filmTrailerEpisode, parseFilmTrailerTokens } from '../film-trailer';

function ep(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: 'ep-1',
    podcastName: 'Show',
    episodeTitle: 'Part',
    episodeDescription: 'Desc',
    release: new Date('2026-01-02T00:00:00Z'),
    duration: '00:10:00',
    youtubeId: 'abc123',
    ...overrides,
  };
}

describe('NowPlayingComponent', () => {
  let fixture: ComponentFixture<NowPlayingComponent>;
  let player: PlayerService;

  beforeEach(async () => {
    // The unit-test runner reuses one TestBed across files. A previous file can leave it
    // instantiated, and configureTestingModule then throws on the first test in this file.
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [NowPlayingComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    }).compileComponents();
    player = TestBed.inject(PlayerService);
    fixture = TestBed.createComponent(NowPlayingComponent);
  });

  function showLink(): HTMLAnchorElement | null {
    return fixture.nativeElement.querySelector('a.stage__show');
  }

  it('hides the parent line for a film', () => {
    player.play(ep({ contentKind: 'Film', podcastName: 'Studio', episodeTitle: 'One Off' }), { mode: 'dock' });
    fixture.detectChanges();
    expect(showLink()).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Studio');
  });

  it('links a TV parent row to the show hub', () => {
    player.play(ep({ contentKind: 'TvShowEpisode', podcastName: 'Nightly' }), { mode: 'dock' });
    fixture.detectChanges();
    expect(showLink()?.getAttribute('href')).toBe('/tv/Nightly');
  });

  it('links a news parent row to the organisation hub', () => {
    player.play(ep({ contentKind: 'NewsReport', podcastName: 'Desk' }), { mode: 'dock' });
    fixture.detectChanges();
    expect(showLink()?.getAttribute('href')).toBe('/news/Desk');
  });

  it('links a playing film trailer back to its film and names the film on a queued trailer', () => {
    const filmId = '00112233-4455-4677-8899-aabbccddeeff';
    const [playingLink, queuedLink] = parseFilmTrailerTokens([
      '00:02:11|https://www.youtube.com/watch?v=synthetic01|Synthetic Teaser',
      '00:01:00|https://www.youtube.com/watch?v=synthetic02|Synthetic Clip',
    ]);
    player.play(filmTrailerEpisode(playingLink, filmId, 0, 'One Off'), { mode: 'dock' });
    player.addToQueue(filmTrailerEpisode(queuedLink, filmId, 1, 'One Off'));
    player.openQueuePanel();
    fixture.detectChanges();

    const short = new GuidService().toCatalogueShortId(filmId, 'Film');
    expect(showLink()?.getAttribute('href')).toBe(`/film/One%20Off/${short}`);
    expect(showLink()?.textContent).toContain('One Off');
    expect(fixture.nativeElement.querySelector('.queue-panel__show')?.textContent?.trim()).toBe('One Off');
    const hrefs = Array.from(fixture.nativeElement.querySelectorAll('a[href]') as NodeListOf<HTMLAnchorElement>)
      .map(anchor => anchor.getAttribute('href') ?? '');
    expect(hrefs.some(href => href.includes(':trailer:'))).toBe(false);
    expect(hrefs.some(href => href.includes(filmId))).toBe(false);
    expect(fixture.nativeElement.querySelector('iframe')?.getAttribute('src')).toContain('youtube.com/embed/');
  });

  it('keeps a podcast parent row on /podcast/', () => {
    player.play(ep({ contentKind: 'Episode', podcastName: 'Show' }), { mode: 'dock' });
    fixture.detectChanges();
    expect(showLink()?.getAttribute('href')).toBe('/podcast/Show');
  });

  it('links "Episode page" for a podcast episode by its short id, not the raw guid', () => {
    const guid = '00112233-4455-4677-8899-aabbccddeeff';
    player.play(ep({ id: guid, contentKind: 'Episode', podcastName: 'Show', youtubeId: undefined }), { mode: 'dock' });
    fixture.detectChanges();
    const page = Array.from(fixture.nativeElement.querySelectorAll('a[href]') as NodeListOf<HTMLAnchorElement>)
      .find(a => a.textContent?.includes('Episode page'));
    expect(page?.getAttribute('href')).toBe(`/podcast/Show/${new GuidService().toBase64(guid)}`);
    const hrefs = Array.from(fixture.nativeElement.querySelectorAll('a[href]') as NodeListOf<HTMLAnchorElement>)
      .map(a => a.getAttribute('href') ?? '');
    expect(hrefs.some(h => h.includes(guid))).toBe(false);
  });
});
