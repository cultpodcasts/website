import { describe, expect, it } from 'vitest';
import { alsoKnownAs } from './also-known-as';

describe('alsoKnownAs', () => {
  it('lists the film alternative titles as "Also known as", and nothing when it has none (RedditPodcastPoster#1431)', () => {
    expect(alsoKnownAs(["Father's House", ' ', 'La casa del padre'])).toBe("Father's House · La casa del padre");
    expect(alsoKnownAs(undefined)).toBeNull();
    expect(alsoKnownAs([])).toBeNull();
  });
});
