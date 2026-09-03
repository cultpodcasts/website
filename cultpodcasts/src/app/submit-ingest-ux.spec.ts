import { describe, expect, it } from 'vitest';
import { submitEpisodePostBody } from './submit-series.util';
import {
  generalDropSeries,
  generalDropSeriesForActor,
  pageDropConfirmAccepted,
  pageDropOtherSeriesQuestion,
  pageDropPlan,
  postSubmitEpisodeDialog,
  shouldCallSubmitUrlLookup
} from './submit-ingest-ux';

const pageId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const episodeUrl = new URL('https://open.spotify.com/episode/0exampleepisode00');

describe('shouldCallSubmitUrlLookup', () => {
  it('never calls GET /submit/lookup unless the actor is a Curator', () => {
    expect(shouldCallSubmitUrlLookup(false)).toBe(false);
    expect(shouldCallSubmitUrlLookup(true)).toBe(true);
  });
});

describe('general drop', () => {
  it('sends URL-only after known-unique lookup so membership is not re-attached', () => {
    expect(submitEpisodePostBody(episodeUrl, generalDropSeries({
      known: true,
      podcastId: pageId,
      podcastName: 'Stored Show',
      kind: 'podcast-service'
    }))).toEqual({
      url: episodeUrl.href,
      podcastId: undefined,
      podcastName: undefined
    });
  });

  it('sends URL-only for unknown podcast-service so platform metadata creates the show', () => {
    expect(submitEpisodePostBody(episodeUrl, generalDropSeries({
      known: false,
      kind: 'podcast-service'
    }))).toEqual({
      url: episodeUrl.href,
      podcastId: undefined,
      podcastName: undefined
    });
  });

  it('sends extracted podcastName for unknown streaming so persist can attach or create without a curator picker', () => {
    const streamingUrl = new URL('https://www.netflix.com/watch/80057281');
    expect(submitEpisodePostBody(streamingUrl, generalDropSeries({
      known: false,
      kind: 'streaming',
      podcastName: 'Extracted Show'
    }))).toEqual({
      url: streamingUrl.href,
      podcastId: undefined,
      podcastName: 'Extracted Show'
    });
  });

  it('signed-out and non-Curator general drop persist URL-only without using lookup', () => {
    const streamingLookup = {
      known: false as const,
      kind: 'streaming' as const,
      podcastName: 'Extracted Show'
    };
    expect(generalDropSeriesForActor(false, streamingLookup)).toEqual({
      podcastId: undefined,
      podcastName: undefined
    });
    expect(generalDropSeriesForActor(true, streamingLookup)).toEqual({
      podcastId: undefined,
      podcastName: 'Extracted Show'
    });
  });

  it('falls back to URL-only when streaming lookup has no extracted name, or lookup failed', () => {
    expect(generalDropSeries({ known: false, kind: 'streaming' })).toEqual({
      podcastId: undefined,
      podcastName: undefined
    });
    expect(generalDropSeries('error')).toEqual({
      podcastId: undefined,
      podcastName: undefined
    });
    expect(generalDropSeries(null)).toEqual({
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
