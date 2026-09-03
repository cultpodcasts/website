import { describe, expect, it } from 'vitest';
import { submitDialogResult, submitEpisodePostBody, showSubmitSeriesPicker } from './submit-series.util';
import {
  generalDropSeriesForActor,
  pageDropConfirmAccepted,
  pageDropOtherSeriesQuestion,
  pageDropPlan,
  shouldCallSubmitUrlLookup
} from './submit-ingest-ux';
import {
  SUBMIT_URL_CONTRACT_COPY_FROM,
  actorIsCurator,
  submitUrlCases,
  submitUrlIds,
  type SubmitUrlCase
} from './submit-url-contract';
import { SubmitUrlLookupResponse } from './submit-url-lookup.interface';

function compactPersist(body: { url: string; podcastId?: string; podcastName?: string }) {
  return {
    url: body.url,
    ...(body.podcastId ? { podcastId: body.podcastId } : {}),
    ...(body.podcastName ? { podcastName: body.podcastName } : {})
  };
}

function persistFromClient(tourCase: SubmitUrlCase) {
  const isCurator = actorIsCurator(tourCase.actor);
  const lookup = tourCase.client.lookup as SubmitUrlLookupResponse | null;
  const url = new URL(tourCase.url);

  if (tourCase.client.pageDropPlanKind) {
    const plan = pageDropPlan(lookup, tourCase.client.pagePodcastId!);
    expect(plan.kind).toBe(tourCase.client.pageDropPlanKind);
    if (plan.kind === 'confirm-other-series') {
      expect(plan.otherPodcastId).toBe(submitUrlIds.otherId);
      expect(pageDropOtherSeriesQuestion(plan.otherPodcastName, tourCase.client.pagePodcastName!)).toContain(
        tourCase.client.pagePodcastName!
      );
    }
    expect(pageDropConfirmAccepted({ result: tourCase.client.confirmAccepted === true })).toBe(
      tourCase.client.confirmAccepted === true
    );
    if (tourCase.client.confirmAccepted !== true) {
      return [];
    }
    return [
      compactPersist(
        submitEpisodePostBody(url, {
          podcastId: tourCase.client.pagePodcastId!,
          podcastName: tourCase.client.pagePodcastName!
        })
      )
    ];
  }

  if (tourCase.client.seriesForm && tourCase.id === 4) {
    expect(submitDialogResult(tourCase.url, lookup, tourCase.client.seriesForm)).toEqual({
      kind: 'resolve-name',
      seriesName: tourCase.client.seriesForm
    });
    return [
      compactPersist(
        submitEpisodePostBody(url, {
          podcastId: tourCase.client.pagePodcastId!,
          podcastName: tourCase.client.seriesForm
        })
      )
    ];
  }

  if (tourCase.client.seriesForm && tourCase.id === 7) {
    return tourCase.client.persistBodies.map((expected, index) =>
      compactPersist(
        submitEpisodePostBody(url, {
          podcastId: index === 0 ? undefined : expected.podcastId,
          podcastName: expected.podcastName
        })
      )
    );
  }

  return [
    compactPersist(submitEpisodePostBody(url, generalDropSeriesForActor(isCurator, lookup)))
  ];
}

/**
 * UI rules consume Api/tests/fixtures/submit-url-contract.ts (copied here).
 * This spec does not invent Worker behaviour — it asserts client helpers emit
 * the same requests the fixture says that actor sends.
 */
describe('submit URL tour business rules', () => {
  it(`documents the copied API contract at ${SUBMIT_URL_CONTRACT_COPY_FROM}`, () => {
    expect(SUBMIT_URL_CONTRACT_COPY_FROM).toBe('Api/tests/fixtures/submit-url-contract.ts');
    expect(submitUrlCases.map((c) => c.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  for (const tourCase of submitUrlCases) {
    it(tourCase.rule, () => {
      const isCurator = actorIsCurator(tourCase.actor);
      expect(shouldCallSubmitUrlLookup(isCurator)).toBe(tourCase.client.shouldCallLookup);
      expect(showSubmitSeriesPicker(isCurator ? ['Curator'] : ['Admin'])).toBe(isCurator);

      const persist = persistFromClient(tourCase);
      expect(persist).toEqual(tourCase.client.persistBodies);

      const postBodies = tourCase.http
        .filter((step) => step.workerRoute === 'submit' && step.method === 'POST')
        .map((step) => step.requestBody);
      expect(postBodies).toEqual(tourCase.client.persistBodies);
    });
  }
});
