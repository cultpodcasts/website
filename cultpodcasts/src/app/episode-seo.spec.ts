import { describe, expect, it } from 'vitest';
import {
  pageDetailsFromSearchEpisode,
  shareImageFieldsFromEpisode,
  withEpisodeShareImage
} from './episode-seo';
import { SearchResult } from './search-result.interface';

const discoveryPlusArt =
  'https://beam-images.warnermediacdn.com/2024-01/example.jpg?host=example.com&partner=beamcom&w=500';

const discoveryPlusArtWithEntities =
  'https://beam-images.warnermediacdn.com/2024-01/example.jpg?host=example.com&amp;partner=beamcom&amp;w=500';

function streamingSearchHit(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: 'c637aca4-6d12-42bf-814c-4441ffcb90e6',
    podcastName: 'Watch People Magazine Investigates',
    episodeTitle: 'The Cult of the Soulful Journey',
    episodeDescription: 'Description',
    release: new Date('2026-07-20T00:00:00Z'),
    duration: '01:00:00',
    subjects: [],
    image: discoveryPlusArt,
    services: {
      discoveryPlus: {
        url: 'https://www.discoveryplus.com/video/example-slug',
        image: discoveryPlusArt
      }
    },
    ...overrides
  };
}

describe('episode SEO share image', () => {
  it('uses search image for streaming-only episodes (same art as hero)', () => {
    const fields = shareImageFieldsFromEpisode(streamingSearchHit());

    expect(fields.image).toBe(discoveryPlusArt);
    expect(fields.imageAspect).toBe('wide');
  });

  it('decodes HTML entities in streaming CDN query strings for og:image', () => {
    const fields = shareImageFieldsFromEpisode(
      streamingSearchHit({ image: discoveryPlusArtWithEntities })
    );

    expect(fields.image).toBe(discoveryPlusArt);
    expect(fields.image).not.toContain('&amp;');
  });

  it('fills missing page-details image from search without clobbering branded og URLs', () => {
    const branded =
      'https://api.cultpodcasts.com/og-image?u=https%3A%2F%2Fi.scdn.co%2Fimage%2Fab6765&a=square';
    const withBranded = withEpisodeShareImage(
      { title: 'Ep | Show', image: branded, imageAspect: 'square' },
      streamingSearchHit()
    );
    expect(withBranded.image).toBe(branded);

    const enriched = withEpisodeShareImage(
      {
        title: 'The Cult of the Soulful Journey | Watch People Magazine Investigates',
        description: 'Watch People Magazine Investigates',
        duration: '01:00:00'
      },
      streamingSearchHit()
    );
    expect(enriched.image).toBe(discoveryPlusArt);
    expect(enriched.imageAspect).toBe('wide');
  });

  it('builds client page-details from a search hit including share art', () => {
    const details = pageDetailsFromSearchEpisode(
      'Watch People Magazine Investigates',
      streamingSearchHit()
    );

    expect(details.title).toBe(
      'The Cult of the Soulful Journey | Watch People Magazine Investigates'
    );
    expect(details.image).toBe(discoveryPlusArt);
    expect(details.imageAspect).toBe('wide');
  });
});
