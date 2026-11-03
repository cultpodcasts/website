import { EpisodePublishResponse } from './episode-publish-response.interface';
import { EpisodePublishResponseAdaptor } from './episode-publish-response-adaptor';

describe('EpisodePublishResponseAdaptor', () => {
  const adaptor = new EpisodePublishResponseAdaptor();

  function resp(overrides: Partial<EpisodePublishResponse> = {}): EpisodePublishResponse {
    return { podcastId: 'pod-a', ...overrides };
  }

  it('uses Episode when contentKind is absent', () => {
    expect(adaptor.createMessage(
      resp({ tweeted: true, blueskyPosted: true }),
      { tweet: true, blueskyPost: true },
    )).toBe('Episode tweeted and bluesky-posted');
  });

  for (const [kind, noun] of [
    ['Film', 'Film'],
    ['NewsReport', 'News Report'],
    ['TvShowEpisode', 'TV Episode'],
  ] as const) {
    it(`uses "${noun}" for ${kind}`, () => {
      expect(adaptor.createMessage(
        resp({ tweeted: true, blueskyPosted: true }),
        { tweet: true, blueskyPost: true },
        kind,
      )).toBe(`${noun} tweeted and bluesky-posted`);
    });
  }

  it('prefixes failure messages with the kind noun', () => {
    expect(adaptor.createMessage(
      resp({ tweeted: false }),
      { tweet: true },
      'Film',
    )).toBe('Film failed to tweet');
  });
});
