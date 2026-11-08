import { describe, expect, it } from 'vitest';
import {
  episodeEditResultMessage,
  socialRetractFailed,
  socialRetractFailureMessage
} from './social-retract-result';

describe('socialRetractFailed', () => {
  it('is false when response omits delete flags', () => {
    expect(socialRetractFailed({})).toBe(false);
    expect(socialRetractFailed(null)).toBe(false);
  });

  it('is true when Bluesky or tweet delete explicitly failed', () => {
    expect(socialRetractFailed({ blueskyPostDeleted: false })).toBe(true);
    expect(socialRetractFailed({ tweetDeleted: false })).toBe(true);
  });

  it('is false when deletes succeeded', () => {
    expect(socialRetractFailed({ blueskyPostDeleted: true, tweetDeleted: true })).toBe(false);
  });
});

describe('socialRetractFailureMessage', () => {
  it('describes Bluesky-only failure', () => {
    expect(socialRetractFailureMessage({ blueskyPostDeleted: false })).toBe(
      'Could not delete Bluesky post — Bluesky posted flag left unchanged'
    );
  });

  it('describes tweet-only failure', () => {
    expect(socialRetractFailureMessage({ tweetDeleted: false })).toBe(
      'Could not delete tweet — Tweeted flag left unchanged'
    );
  });

  it('describes both failures', () => {
    expect(socialRetractFailureMessage({ blueskyPostDeleted: false, tweetDeleted: false })).toBe(
      'Could not delete Bluesky post or tweet — posted flags left unchanged'
    );
  });

  it('is null when nothing failed', () => {
    expect(socialRetractFailureMessage({ blueskyPostDeleted: true })).toBeNull();
  });
});

describe('episodeEditResultMessage', () => {
  it('returns Episode updated on success without retract failure', () => {
    expect(episodeEditResultMessage({ updated: true, response: {} })).toBe('Episode updated');
  });

  it('prefers retract failure over Episode updated', () => {
    expect(
      episodeEditResultMessage({ updated: true, response: { blueskyPostDeleted: false } })
    ).toBe('Could not delete Bluesky post — Bluesky posted flag left unchanged');
  });

  it('returns No change', () => {
    expect(episodeEditResultMessage({ noChange: true })).toBe('No change');
  });

  it('returns null when dialog was dismissed', () => {
    expect(episodeEditResultMessage(undefined)).toBeNull();
    expect(episodeEditResultMessage({ closed: true })).toBeNull();
  });
});
