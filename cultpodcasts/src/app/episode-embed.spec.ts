import {
  appleEmbedUrl,
  canEmbedEpisode,
  canPlayEpisode,
  episodeEmbedOptions,
  playActionLabel,
  preferredEmbedService,
  spotifyEmbedUrl,
  startEpisodePlayback,
  youtubeEmbedUrl,
} from './episode-embed';
import { HomepageEpisode } from './homepage-episode.interface';
import { SearchDisplayEpisode } from './search-result-links';

function episode(partial: Partial<HomepageEpisode> = {}): HomepageEpisode {
  return {
    id: 'id',
    podcastName: 'Podcast',
    episodeTitle: 'Title',
    episodeDescription: 'Description',
    release: new Date('2026-07-17T00:00:00Z'),
    duration: '00:41:02',
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
      services: {
        youtube: { url: 'https://www.youtube.com/watch?v=abc123DEF45' },
        spotify: { url: 'https://open.spotify.com/episode/7ouMYWpwJ422jRcDASZB7P' },
        apple: { url: 'https://podcasts.apple.com/us/podcast/id1?i=2' },
      },
    }));
    expect(options.map((o) => o.service)).toEqual(['youtube', 'spotify', 'apple']);
    expect(preferredEmbedService(options)).toBe('youtube');
  });

  it('labels YouTube-first episodes Watch and others Listen', () => {
    expect(playActionLabel(episode({
      services: { youtube: { url: 'https://www.youtube.com/watch?v=abc123DEF45' } },
    }))).toBe('Watch');
    expect(playActionLabel(episode({
      services: { spotify: { url: 'https://open.spotify.com/episode/7ouMYWpwJ422jRcDASZB7P' } },
    }))).toBe('Listen');
    expect(playActionLabel(episode())).toBe('Listen');
  });

  it('returns no embed options when no embeddable links exist', () => {
    expect(episodeEmbedOptions(episode())).toEqual([]);
    expect(canEmbedEpisode(episode())).toBe(false);
  });

  it('offers Watch for BBC iPlayer and Internet Archive without embedding', () => {
    const iplayer = episode({
      services: { bbcIplayer: { url: 'https://www.bbc.co.uk/iplayer/episode/p0abc123/jared-leto' } },
      image: new URL('https://i.scdn.co/image/opaque'),
    });
    const archive = episode({
      services: { internetArchive: { url: 'https://archive.org/details/example-video' } },
    });
    const sounds = episode({
      services: { bbcSounds: { url: 'https://www.bbc.co.uk/sounds/play/m001abcd' } },
    });

    expect(canEmbedEpisode(iplayer)).toBe(false);
    expect(canPlayEpisode(iplayer)).toBe(true);
    expect(playActionLabel(iplayer)).toBe('Watch');

    expect(canPlayEpisode(archive)).toBe(true);
    expect(playActionLabel(archive)).toBe('Watch');

    expect(canEmbedEpisode(sounds)).toBe(false);
    expect(canPlayEpisode(sounds)).toBe(true);
    expect(playActionLabel(sounds)).toBe('Listen');
  });

  it('prefers in-app Listen over outbound Watch when Spotify and iPlayer both exist', () => {
    const both = episode({
      services: {
        spotify: { url: 'https://open.spotify.com/episode/7ouMYWpwJ422jRcDASZB7P' },
        bbcIplayer: { url: 'https://www.bbc.co.uk/iplayer/episode/p0abc123/jared-leto' },
      },
    });
    expect(canEmbedEpisode(both)).toBe(true);
    expect(playActionLabel(both)).toBe('Listen');
  });

  it('starts embed playback or opens external Watch / Listen', () => {
    const yt = episode({
      services: { youtube: { url: 'https://www.youtube.com/watch?v=abc123DEF45' } },
    });
    const iplayer = episode({
      services: { bbcIplayer: { url: 'https://www.bbc.co.uk/iplayer/episode/p0abc123/jared-leto' } },
    });
    const sounds = episode({
      services: { bbcSounds: { url: 'https://www.bbc.co.uk/sounds/play/m001abcd' } },
    });
    const played: SearchDisplayEpisode[] = [];
    const opened: string[] = [];

    expect(startEpisodePlayback(yt, (ep) => played.push(ep), (url) => opened.push(url.toString()))).toBe(true);
    expect(played).toHaveLength(1);
    expect(opened).toHaveLength(0);

    expect(startEpisodePlayback(iplayer, (ep) => played.push(ep), (url) => opened.push(url.toString()))).toBe(true);
    expect(played).toHaveLength(1);
    expect(opened).toEqual(['https://www.bbc.co.uk/iplayer/episode/p0abc123/jared-leto']);

    expect(startEpisodePlayback(sounds, (ep) => played.push(ep), (url) => opened.push(url.toString()))).toBe(true);
    expect(played).toHaveLength(1);
    expect(opened).toEqual([
      'https://www.bbc.co.uk/iplayer/episode/p0abc123/jared-leto',
      'https://www.bbc.co.uk/sounds/play/m001abcd',
    ]);

    expect(startEpisodePlayback(episode(), (ep) => played.push(ep), (url) => opened.push(url.toString()))).toBe(false);
  });
});
