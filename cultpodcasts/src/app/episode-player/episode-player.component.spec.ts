import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { EpisodePlayerComponent } from './episode-player.component';
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

describe('EpisodePlayerComponent', () => {
  let fixture: ComponentFixture<EpisodePlayerComponent>;
  let player: PlayerService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EpisodePlayerComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    }).compileComponents();

    player = TestBed.inject(PlayerService);
    fixture = TestBed.createComponent(EpisodePlayerComponent);
  });

  function showLink(): HTMLAnchorElement | null {
    return fixture.nativeElement.querySelector('a.stage__show');
  }

  it('hides the parent line on a film', () => {
    player.play(ep({ contentKind: 'Film', podcastName: 'Studio', episodeTitle: 'One Off' }), { mode: 'dock' });
    fixture.detectChanges();

    expect(showLink()).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Studio');
    expect(fixture.nativeElement.textContent).toContain('One Off');
  });

  it('links a TV parent row to the show hub', () => {
    player.play(ep({ contentKind: 'TvShowEpisode', podcastName: 'Nightly', episodeTitle: 'Part' }), { mode: 'dock' });
    fixture.detectChanges();

    expect(showLink()?.getAttribute('href')).toBe('/tv/Nightly');
    expect(showLink()?.textContent?.trim()).toBe('Nightly');
  });

  it('links a news parent row to the organisation hub', () => {
    player.play(ep({ contentKind: 'NewsReport', podcastName: 'Desk', episodeTitle: 'Bulletin' }), { mode: 'dock' });
    fixture.detectChanges();

    expect(showLink()?.getAttribute('href')).toBe('/news/Desk');
  });

  it('keeps a podcast parent row on /podcast/', () => {
    player.play(ep({ contentKind: 'Episode', podcastName: 'Show' }), { mode: 'dock' });
    fixture.detectChanges();

    expect(showLink()?.getAttribute('href')).toBe('/podcast/Show');
  });
});
