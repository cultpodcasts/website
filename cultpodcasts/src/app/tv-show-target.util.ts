/** BBC catch-all podcasts whose programmes become shows published by BBC. */
const BBC_PODCAST = /^bbc( three)?$/i;

/** The publisher a new TV show defaults to for an episode of this podcast. */
export function defaultPublisher(podcastName: string | null | undefined): string {
  return BBC_PODCAST.test((podcastName ?? '').trim()) ? 'BBC' : '';
}
