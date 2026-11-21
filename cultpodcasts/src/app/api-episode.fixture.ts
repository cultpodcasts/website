import { ApiEpisode } from './api-episode.interface';

/**
 * Test fixture: a full curator episode as the app receives it. The generated `Api.Dtos.EpisodeDto` has every key the
 * Functions serializer writes (unset values are null; RedditPodcastPoster#1502), and `release` is the `Date` that
 * JsonDateInterceptor produces. Spec-only: nothing in the app imports this file.
 */
export function wireApiEpisode(overrides: Partial<ApiEpisode> = {}): ApiEpisode {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    podcastId: '22222222-2222-2222-2222-222222222222',
    title: 'Title',
    description: 'Desc',
    podcastName: 'Show',
    release: new Date('2026-07-01T12:00:00.000Z'),
    displayTitle: 'Title',
    duration: '01:00:00',
    explicit: false,
    posted: false,
    displayDescription: 'Desc',
    tweeted: false,
    bluesky: null,
    ignored: false,
    removed: false,
    lang: null,
    spotifyId: '',
    appleId: null,
    youTubeId: '',
    ids: null,
    urls: { spotify: null, apple: null, youtube: null, internetArchive: null, bbc: null },
    subjects: [],
    removedSubjects: [],
    matches: [],
    searchTerms: null,
    hashTag: null,
    images: null,
    services: null,
    guests: null,
    youTubePodcast: false,
    spotifyPodcast: false,
    applePodcast: false,
    releaseAuthority: null,
    primaryPostService: null,
    image: null,
    guestPeople: null,
    guestSuggestions: null,
    ...overrides
  };
}

/** Full `Api.Dtos.EpisodeImagesDto` (every key present). */
export function wireEpisodeImages(images: Partial<NonNullable<ApiEpisode['images']>> = {}): NonNullable<ApiEpisode['images']> {
  return { youtube: null, spotify: null, apple: null, other: null, ...images };
}
