import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { NowPlayingComponent } from './now-playing.component';
import { PlayerService } from '../player.service';
import { SearchResult } from '../search-result.interface';

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

  it('keeps a podcast parent row on /podcast/', () => {
    player.play(ep({ contentKind: 'Episode', podcastName: 'Show' }), { mode: 'dock' });
    fixture.detectChanges();
    expect(showLink()?.getAttribute('href')).toBe('/podcast/Show');
  });
});
