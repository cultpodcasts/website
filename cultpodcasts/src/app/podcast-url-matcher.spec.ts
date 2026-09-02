import { describe, expect, it } from 'vitest';
import {
  extractUrlFromDataTransfer,
  isSubmittablePodcastUrl,
  parseSubmittablePodcastUrl,
  urlsReferToSameEpisode
} from './podcast-url-matcher';

describe('podcast-url-matcher', () => {
  it('accepts Spotify, YouTube, Apple, BBC, Archive, Vimeo, Netflix, and Prime Video URLs', () => {
    const accepted = [
      'https://open.spotify.com/episode/opaqueid00000000000000',
      'https://www.youtube.com/watch?v=yt123456789',
      'https://podcasts.apple.com/us/podcast/show-name/id1234567890123?i=1234567890123',
      'https://www.bbc.co.uk/sounds/play/p0example',
      'https://www.bbc.co.uk/iplayer/episode/p0abcd12/example-slug',
      'https://archive.org/details/example-item',
      'https://vimeo.com/123456789',
      'https://www.netflix.com/title/80057281',
      'https://www.primevideo.com/detail/0EXAMPLEID00'
    ];

    for (const url of accepted) {
      expect(isSubmittablePodcastUrl(url), url).toBe(true);
      expect(parseSubmittablePodcastUrl(url)?.toString()).toContain('http');
    }
  });

  it('rejects news and other non-episode hosts', () => {
    expect(isSubmittablePodcastUrl('https://www.bbc.co.uk/news/example')).toBe(false);
    expect(isSubmittablePodcastUrl('https://example.test/watch/1')).toBe(false);
    expect(isSubmittablePodcastUrl('')).toBe(false);
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
