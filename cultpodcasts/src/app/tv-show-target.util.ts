const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** BBC catch-all podcasts whose programmes become shows published by BBC. */
const BBC_PODCAST = /^bbc( three)?$/i;

/** Whether the text is a bare GUID (a pasted TV show id, as opposed to a show name). */
export function isGuid(text: string): boolean {
  return GUID.test(text);
}

/** The publisher a new TV show defaults to for an episode of this podcast. */
export function defaultPublisher(podcastName: string | null | undefined): string {
  return BBC_PODCAST.test((podcastName ?? '').trim()) ? 'BBC' : '';
}
