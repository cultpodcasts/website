import { wirePublicEpisode } from './public-episode.fixture';
import { publicEpisodeToHomepageEpisode } from './api-episode-display';

describe('publicEpisodeToHomepageEpisode', () => {
  it('maps public API episode fields into the shared poster display shape', () => {
    const episode = wirePublicEpisode({
      id: 'ep-1',
      title: 'Raw Title',
      podcastName: 'Show Name',
      description: 'Raw description',
      release: new Date('2024-01-02T12:00:00Z'),
      duration: '01:02:03',
      ids: { spotify: 'abc', apple: null, youtube: 'xyz' },
      services: {
        spotify: { url: 'https://open.spotify.com/episode/abc' },
        youtube: { url: 'https://www.youtube.com/watch?v=xyz' },
      },
      subjects: ['Subject A'],
      // Wire string, already coalesced server-side: the display mapping parses it into a URL.
      image: 'https://i.ytimg.com/vi/xyz/hqdefault.jpg',
    });

    const display = publicEpisodeToHomepageEpisode(episode);

    expect(display.id).toBe('ep-1');
    expect(display.episodeTitle).toBe('Raw Title');
    expect(display.episodeDescription).toBe('Raw description');
    expect(display.podcastName).toBe('Show Name');
    expect(display.release).toEqual(new Date('2024-01-02T12:00:00Z'));
    expect(display.ids).toEqual({ spotify: 'abc', apple: null, youtube: 'xyz' });
    expect(display.services?.['spotify']?.url?.toString()).toBe('https://open.spotify.com/episode/abc');
    expect(display.services?.['youtube']?.url?.toString()).toBe('https://www.youtube.com/watch?v=xyz');
    expect(display.subjects).toEqual(['Subject A']);
    expect(display.image?.toString()).toBe('https://i.ytimg.com/vi/xyz/hqdefault.jpg');
    expect(display.imageRemoved).toBeUndefined();
  });

  it('leaves ids and services unset when the public body has none', () => {
    const display = publicEpisodeToHomepageEpisode(wirePublicEpisode({ services: {} }));

    expect(display.ids).toBeUndefined();
    expect(display.services).toBeUndefined();
    expect(display.image).toBeUndefined();
  });

  it('drops the image and carries imageRemoved when a curator removed it (RPP #1500)', () => {
    const episode = wirePublicEpisode({
      ids: { spotify: null, apple: null, youtube: 'xyz' },
      services: { youtube: { url: 'https://www.youtube.com/watch?v=xyz' } },
      image: null,
      imageRemoved: true,
    });

    const display = publicEpisodeToHomepageEpisode(episode);

    expect(display.image).toBeUndefined();
    expect(display.imageRemoved).toBe(true);
  });
});
