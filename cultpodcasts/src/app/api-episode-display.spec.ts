import { ApiEpisode } from './api-episode.interface';
import { apiEpisodeToHomepageEpisode } from './api-episode-display';

describe('apiEpisodeToHomepageEpisode', () => {
  it('maps API episode fields into the shared poster display shape', () => {
    const episode = {
      id: 'ep-1',
      title: 'Raw Title',
      displayTitle: 'Display Title',
      podcastName: 'Show Name',
      description: 'Raw description',
      displayDescription: 'Display description',
      posted: true,
      tweeted: false,
      ignored: false,
      removed: false,
      explicit: false,
      release: new Date('2024-01-02T12:00:00Z'),
      duration: '01:02:03',
      urls: {
        spotify: new URL('https://open.spotify.com/episode/abc'),
        youtube: new URL('https://www.youtube.com/watch?v=xyz'),
      },
      subjects: ['Subject A'],
      image: new URL('https://i.ytimg.com/vi/xyz/hqdefault.jpg'),
      lang: 'es',
    } as ApiEpisode;

    const display = apiEpisodeToHomepageEpisode(episode);

    expect(display.id).toBe('ep-1');
    expect(display.episodeTitle).toBe('Display Title');
    expect(display.episodeDescription).toBe('Display description');
    expect(display.podcastName).toBe('Show Name');
    expect(display.services?.['spotify']?.url?.toString()).toBe('https://open.spotify.com/episode/abc');
    expect(display.services?.['youtube']?.url?.toString()).toBe('https://www.youtube.com/watch?v=xyz');
    expect(display.language).toBe('es');
    expect(display.image?.toString()).toBe('https://i.ytimg.com/vi/xyz/hqdefault.jpg');
  });
});
