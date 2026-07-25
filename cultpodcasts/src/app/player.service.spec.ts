import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { PlayerService } from './player.service';
import { SearchDisplayEpisode } from './search-result-links';

function ep(id: string): SearchDisplayEpisode {
  return {
    id,
    podcastName: `Show ${id}`,
    episodeTitle: `Episode ${id}`,
    episodeDescription: `Desc ${id}`,
    release: new Date(),
    duration: '01:00:00',
    youtube: new URL(`https://www.youtube.com/watch?v=${id}`),
    subjects: [],
  };
}

describe('PlayerService', () => {
  let service: PlayerService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: PLATFORM_ID, useValue: 'server' },
        PlayerService,
      ],
    });
    service = TestBed.inject(PlayerService);
  });

  it('exposes queuedKeys for O(1) membership checks', () => {
    service.addToQueue(ep('a'));
    service.addToQueue(ep('b'));
    expect([...service.queuedKeys()].sort()).toEqual(['a', 'b']);
    expect(service.isQueuedId('a')).toBe(true);
    expect(service.isQueuedId('z')).toBe(false);

    service.removeFromQueue(ep('a'));
    expect(service.queuedKeys().has('a')).toBe(false);
    expect(service.isQueued(ep('b'))).toBe(true);
  });
});
