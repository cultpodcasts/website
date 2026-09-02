import { describe, expect, it } from 'vitest';
import { submitEpisodePostBody } from './submit-series.util';
import {
  generalDropSeries,
  pageDropConfirmAccepted,
  pageDropOtherSeriesQuestion,
  pageDropPlan,
  postSubmitEpisodeDialog
} from './submit-ingest-ux';

const pageId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const episodeUrl = new URL('https://open.spotify.com/episode/0exampleepisode00');

describe('general drop', () => {
  it('sends URL-only so Cult Podcasts matches the series automatically', () => {
    expect(submitEpisodePostBody(episodeUrl, generalDropSeries())).toEqual({
      url: episodeUrl.href,
      podcastId: undefined,
      podcastName: undefined
    });
  });
});

describe('pageDropPlan', () => {
  it('submits to this podcast when lookup is unknown, because attach is the point of the page target', () => {
    expect(pageDropPlan({ known: false, kind: 'podcast-service' }, pageId)).toEqual({ kind: 'submit-to-page' });
    expect(pageDropPlan({ known: false, kind: 'streaming' }, pageId)).toEqual({ kind: 'submit-to-page' });
  });

  it('submits to this podcast when membership is ambiguous, without opening the 409 picker', () => {
    expect(pageDropPlan({
      known: false,
      ambiguous: true,
      podcastIds: [pageId, otherId]
    }, pageId)).toEqual({ kind: 'submit-to-page' });
  });

  it('submits to this podcast when lookup failed or was skipped', () => {
    expect(pageDropPlan('error', pageId)).toEqual({ kind: 'submit-to-page' });
    expect(pageDropPlan(null, pageId)).toEqual({ kind: 'submit-to-page' });
  });

  it('submits without a warning when the URL already belongs to this page', () => {
    expect(pageDropPlan({
      known: true,
      podcastId: pageId,
      podcastName: 'Page Show'
    }, pageId)).toEqual({ kind: 'submit-to-page' });
    expect(pageDropPlan({
      known: true,
      podcastId: pageId.toUpperCase(),
      podcastName: 'Page Show'
    }, pageId)).toEqual({ kind: 'submit-to-page' });
  });

  it('requires confirm when the URL is already stored on a different series', () => {
    expect(pageDropPlan({
      known: true,
      podcastId: otherId,
      podcastName: 'Other Show'
    }, pageId)).toEqual({
      kind: 'confirm-other-series',
      otherPodcastId: otherId,
      otherPodcastName: 'Other Show'
    });
  });
});

describe('pageDropConfirmAccepted', () => {
  it('treats only explicit Yes as continue; No and dismiss cancel so we do not silently re-home', () => {
    expect(pageDropConfirmAccepted({ result: true })).toBe(true);
    expect(pageDropConfirmAccepted({ result: false })).toBe(false);
    expect(pageDropConfirmAccepted(undefined)).toBe(false);
    expect(pageDropConfirmAccepted(null)).toBe(false);
  });
});

describe('pageDropOtherSeriesQuestion', () => {
  it('names both series so the curator can refuse attaching to the page', () => {
    expect(pageDropOtherSeriesQuestion('Other Show', 'Page Show')).toBe(
      'This URL is already on Other Show. Submit to Page Show anyway?'
    );
  });
});

describe('postSubmitEpisodeDialog', () => {
  it('opens Add Episode only for a newly created episode; podcast stays read-only there', () => {
    expect(postSubmitEpisodeDialog('Created')).toBe('add-episode');
  });

  it('opens Edit Episode when submit enriched or found an existing episode', () => {
    expect(postSubmitEpisodeDialog('Enriched')).toBe('edit-episode');
    expect(postSubmitEpisodeDialog('EpisodeAlreadyExists')).toBe('edit-episode');
  });

  it('does not open an episode form for other submit outcomes', () => {
    expect(postSubmitEpisodeDialog('Ignored')).toBe('none');
    expect(postSubmitEpisodeDialog(undefined)).toBe('none');
  });
});
