import {
  appleEmbedUrl,
  episodeEmbedOptions,
  playActionLabel,
  preferredEmbedService,
  spotifyEmbedUrl,
  youtubeEmbedUrl,
} from './episode-embed';
import { HomepageEpisode } from './homepage-episode.interface';

function episode(partial: Partial<HomepageEpisode> = {}): HomepageEpisode {
  return {
    id: 'id',
    podcastName: 'Podcast',
    episodeTitle: 'Title',
    episodeDescription: 'Description',
    release: new Date('2026-07-17T00:00:00Z'),
    duration: '00:41:02',
    spotify: undefined,
    apple: undefined,
    youtube: undefined,
    bbc: undefined,
    internetArchive: undefined,
    subjects: undefined,
    image: undefined,
    ...partial,
  };
}

describe('episode-embed', () => {
  it('builds a YouTube embed from watch and short URLs', () => {
    expect(youtubeEmbedUrl(new URL('https://www.youtube.com/watch?v=abc123DEF45')))
      .toBe('https://www.youtube.com/embed/abc123DEF45?autoplay=1&rel=0');
    expect(youtubeEmbedUrl(new URL('https://youtu.be/abc123DEF45')))
      .toBe('https://www.youtube.com/embed/abc123DEF45?autoplay=1&rel=0');
    expect(youtubeEmbedUrl(new URL('https://www.youtube.com/shorts/abc123DEF45')))
      .toBe('https://www.youtube.com/embed/abc123DEF45?autoplay=1&rel=0');
  });

  it('builds Spotify and Apple embeds', () => {
    expect(spotifyEmbedUrl(new URL('https://open.spotify.com/episode/7ouMYWpwJ422jRcDASZB7P')))
      .toBe('https://open.spotify.com/embed/episode/7ouMYWpwJ422jRcDASZB7P?utm_source=generator&theme=0');
    expect(appleEmbedUrl(new URL('https://podcasts.apple.com/gb/podcast/show-name/id1234567890?i=9876543210')))
      .toBe('https://embed.podcasts.apple.com/gb/podcast/id1234567890?i=9876543210');
  });

  it('prefers YouTube then Spotify then Apple', () => {
    const options = episodeEmbedOptions(episode({
      youtube: new URL('https://www.youtube.com/watch?v=abc123DEF45'),
      spotify: new URL('https://open.spotify.com/episode/7ouMYWpwJ422jRcDASZB7P'),
      apple: new URL('https://podcasts.apple.com/us/podcast/id1?i=2'),
    }));
    expect(options.map((o) => o.service)).toEqual(['youtube', 'spotify', 'apple']);
    expect(preferredEmbedService(options)).toBe('youtube');
  });

  it('labels YouTube-first episodes Watch and others Listen', () => {
    expect(playActionLabel(episode({
      youtube: new URL('https://www.youtube.com/watch?v=abc123DEF45'),
    }))).toBe('Watch');
    expect(playActionLabel(episode({
      spotify: new URL('https://open.spotify.com/episode/7ouMYWpwJ422jRcDASZB7P'),
    }))).toBe('Listen');
    expect(playActionLabel(episode())).toBe('Listen');
  });

  it('returns no options when no embeddable links exist', () => {
    expect(episodeEmbedOptions(episode())).toEqual([]);
  });
});
