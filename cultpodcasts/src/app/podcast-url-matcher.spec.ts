import { describe, expect, it } from 'vitest';
import {
  classifySubmittablePodcastUrl,
  extractUrlFromDataTransfer,
  isSubmittablePodcastUrl,
  parseSubmittablePodcastUrl,
  urlsReferToSameEpisode
} from './podcast-url-matcher';

describe('podcast-url-matcher', () => {
  it('accepts Spotify, YouTube, Apple, BBC, Archive, Vimeo, Netflix, Prime Video, and next-wave streaming URLs', () => {
    const accepted = [
      'https://open.spotify.com/episode/opaqueid00000000000000',
      'https://www.youtube.com/watch?v=yt123456789',
      'https://podcasts.apple.com/us/podcast/show-name/id1234567890123?i=1234567890123',
      'https://www.bbc.co.uk/sounds/play/p0example',
      'https://www.bbc.co.uk/iplayer/episode/p0abcd12/example-slug',
      'https://archive.org/details/example-item',
      'https://vimeo.com/123456789',
      'https://player.vimeo.com/video/123456789',
      'https://www.netflix.com/title/80057281',
      'https://www.netflix.com/watch/80057281',
      'https://www.primevideo.com/detail/0EXAMPLEID00',
      'https://www.primevideo.com/region/na/detail/0EXAMPLEID00',
      'https://www.amazon.com/gp/video/detail/B0EXAMPLE00',
      'https://www.amazon.co.uk/gp/video/detail/B0EXAMPLE00',
      'https://www.itv.com/watch/example-slug/1a2345',
      'https://www.itv.com/watch/example-slug/1a2345/1a2345a0001',
      'https://www.channel4.com/programmes/example-slug',
      'https://www.channel4.com/programmes/example-slug/on-demand/75051-091',
      'https://www.all4.com/programmes/example-slug',
      'https://fawesome.tv/movies/1/example-slug',
      'https://www.paramountplus.com/shows/example-slug/',
      'https://www.max.com/shows/example-slug',
      'https://www.hbomax.com/series/urn:hbo:series:example',
      'https://www.playsuisse.ch/watch/2261604',
      'https://www.tvnz.co.nz/shows/example-slug',
      'https://www.disneyplus.com/series/example-slug',
      'https://www.disneyplus.com/browse/entity-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      'https://www.discoveryplus.com/show/example-slug',
      'https://www.discoveryplus.com/gb/show/example-slug',
      'https://www.discoveryplus.com/video/975f6b9d-d38e-4108-a413-046c0f482c62',
      'https://www.discoveryplus.com/movie/975f6b9d-d38e-4108-a413-046c0f482c62',
      'https://www.discoveryplus.com/gb/movie/975f6b9d-d38e-4108-a413-046c0f482c62'
    ];

    for (const url of accepted) {
      expect(isSubmittablePodcastUrl(url), url).toBe(true);
      expect(parseSubmittablePodcastUrl(url)?.href, url).toBe(new URL(url).href);
    }
  });

  it('rejects news and marketing hosts that are not catalogue title pages', () => {
    expect(isSubmittablePodcastUrl('https://www.bbc.co.uk/news/example')).toBe(false);
    expect(isSubmittablePodcastUrl('https://example.test/watch/1')).toBe(false);
    expect(isSubmittablePodcastUrl('https://www.itv.com/watch/news/example')).toBe(false);
    expect(isSubmittablePodcastUrl('https://www.channel4.com/categories/example')).toBe(false);
    expect(isSubmittablePodcastUrl('https://www.channel4.com/programmes/example-slug/clips')).toBe(false);
    expect(isSubmittablePodcastUrl('https://www.paramountplus.com/shows')).toBe(false);
    expect(isSubmittablePodcastUrl('https://www.max.com/')).toBe(false);
    expect(isSubmittablePodcastUrl('https://fawesome.tv/')).toBe(false);
    expect(isSubmittablePodcastUrl('')).toBe(false);
  });

  it('classifies Spotify/Apple/YouTube as podcast-service and BBC/Archive/Vimeo/Netflix/Prime as streaming', () => {
    expect(classifySubmittablePodcastUrl('https://open.spotify.com/episode/opaqueid00000000000000')).toBe('podcast-service');
    expect(classifySubmittablePodcastUrl('https://www.youtube.com/watch?v=yt123456789')).toBe('podcast-service');
    expect(classifySubmittablePodcastUrl('https://podcasts.apple.com/us/podcast/show-name/id1234567890123?i=1234567890123')).toBe('podcast-service');
    expect(classifySubmittablePodcastUrl('https://www.bbc.co.uk/sounds/play/p0example')).toBe('streaming');
    expect(classifySubmittablePodcastUrl('https://archive.org/details/example-item')).toBe('streaming');
    expect(classifySubmittablePodcastUrl('https://vimeo.com/123456789')).toBe('streaming');
    expect(classifySubmittablePodcastUrl('https://www.netflix.com/watch/80057281')).toBe('streaming');
    expect(classifySubmittablePodcastUrl('https://www.primevideo.com/detail/0EXAMPLEID00')).toBe('streaming');
    expect(classifySubmittablePodcastUrl('https://www.itv.com/watch/example-slug/1a2345')).toBe('streaming');
    expect(classifySubmittablePodcastUrl('https://www.channel4.com/programmes/example-slug')).toBe('streaming');
    expect(classifySubmittablePodcastUrl('https://fawesome.tv/movies/1/example-slug')).toBe('streaming');
    expect(classifySubmittablePodcastUrl('https://www.paramountplus.com/shows/example-slug/')).toBe('streaming');
    expect(classifySubmittablePodcastUrl('https://www.max.com/shows/example-slug')).toBe('streaming');
    expect(classifySubmittablePodcastUrl('https://www.hbomax.com/series/urn:hbo:series:example')).toBe('streaming');
    expect(classifySubmittablePodcastUrl('https://www.playsuisse.ch/watch/2261604')).toBe('streaming');
    expect(classifySubmittablePodcastUrl('https://www.tvnz.co.nz/shows/example-slug')).toBe('streaming');
    expect(classifySubmittablePodcastUrl('https://www.disneyplus.com/series/example-slug')).toBe('streaming');
    expect(classifySubmittablePodcastUrl('https://www.discoveryplus.com/show/example-slug')).toBe('streaming');
    expect(classifySubmittablePodcastUrl('https://www.discoveryplus.com/movie/975f6b9d-d38e-4108-a413-046c0f482c62')).toBe('streaming');
    expect(classifySubmittablePodcastUrl('https://example.test/watch/1')).toBeUndefined();
  });

  it('treats scheme-relative Spotify URLs as submittable', () => {
    const parsed = parseSubmittablePodcastUrl('//open.spotify.com/episode/opaqueid00000000000000');
    expect(parsed?.href).toBe('https://open.spotify.com/episode/opaqueid00000000000000');
  });

  it('compares episode identity after parsing query noise', () => {
    const a = new URL('https://www.youtube.com/watch?v=yt123456789&feature=share');
    const b = new URL('https://www.youtube.com/watch?v=yt123456789');
    expect(urlsReferToSameEpisode(a, b)).toBe(true);
  });

  it('reads a URL from a uri-list data transfer', () => {
    const dataTransfer = {
      getData: (type: string) => type === 'text/uri-list'
        ? '#comment\nhttps://vimeo.com/123456789'
        : ''
    } as DataTransfer;

    expect(extractUrlFromDataTransfer(dataTransfer)).toBe('https://vimeo.com/123456789');
  });
});
