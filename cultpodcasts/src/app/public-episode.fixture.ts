import { PublicEpisode } from './public-episode.interface';

/**
 * Test fixture: a full public episode as the app receives it from `GET /public/episode/:id`. The generated
 * `Api.Dtos.PublicEpisodeDto` has every key the Functions serializer writes (unset values are null; optional keys are
 * omitted when null; RedditPodcastPoster#1502), and `release` is the `Date` that JsonDateInterceptor produces.
 * Spec-only: nothing in the app imports this file.
 */
export function wirePublicEpisode(overrides: Partial<PublicEpisode> = {}): PublicEpisode {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    podcastName: 'Show',
    title: 'Title',
    description: 'Desc',
    release: new Date('2026-07-01T12:00:00.000Z'),
    duration: '01:00:00',
    explicit: false,
    subjects: [],
    ids: null,
    services: null,
    image: null,
    ...overrides
  };
}
