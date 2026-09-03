import { SubmitUrlLookupResponse } from './submit-url-lookup.interface';
import { SubmitSeriesSelection } from './submit-series.util';

/**
 * Worker public gate is Curator (`curate` JWT). Client uses the Auth0 Curator role.
 * Signed-out and signed-in-without-Curator never call GET /submit/lookup.
 */
export function shouldCallSubmitUrlLookup(isCurator: boolean): boolean {
  return isCurator;
}

/**
 * Homepage general drop / share after GET /submit/lookup (Curator only).
 * Known unique or unknown podcast-service → URL-only (platform metadata / stored membership).
 * Unknown streaming → persist extracted podcastName when lookup returned it (no curator picker).
 * Ambiguous / error → URL-only (do not invent a Series picker).
 */
export function generalDropSeries(
  lookup: SubmitUrlLookupResponse | 'error' | null
): SubmitSeriesSelection {
  const urlOnly = (): SubmitSeriesSelection => ({ podcastId: undefined, podcastName: undefined });
  if (!lookup || lookup === 'error') {
    return urlOnly();
  }
  if (lookup.known || lookup.ambiguous) {
    return urlOnly();
  }
  if (lookup.kind === 'streaming') {
    const extracted = lookup.podcastName?.trim();
    if (extracted) {
      return { podcastId: undefined, podcastName: extracted };
    }
  }
  return urlOnly();
}

/** Non-Curator general drop / share / Add Podcast: URL-only POST, never lookup-derived names. */
export function generalDropSeriesForActor(
  isCurator: boolean,
  lookup: SubmitUrlLookupResponse | 'error' | null
): SubmitSeriesSelection {
  if (!shouldCallSubmitUrlLookup(isCurator)) {
    return { podcastId: undefined, podcastName: undefined };
  }
  return generalDropSeries(lookup);
}

export type PageDropPlan =
  | { kind: 'submit-to-page' }
  | {
      kind: 'confirm-other-series';
      otherPodcastId: string;
      otherPodcastName: string;
    };

function samePodcastId(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

/**
 * Submit-to-this-podcast always uses the page's podcastId.
 * Lookup only gates the dangerous case: URL already stored on a *different* series.
 * Unknown, ambiguous, error, or same series → POST to the page with no extra picker.
 */
export function pageDropPlan(
  lookup: SubmitUrlLookupResponse | 'error' | null,
  pagePodcastId: string
): PageDropPlan {
  if (lookup && lookup !== 'error' && lookup.known) {
    if (!samePodcastId(lookup.podcastId, pagePodcastId)) {
      return {
        kind: 'confirm-other-series',
        otherPodcastId: lookup.podcastId,
        otherPodcastName: lookup.podcastName
      };
    }
  }
  return { kind: 'submit-to-page' };
}

export function pageDropOtherSeriesQuestion(otherPodcastName: string, pagePodcastName: string): string {
  return `This URL is already on ${otherPodcastName}. Submit to ${pagePodcastName} anyway?`;
}

/** Backdrop / No / undefined close is cancel. Only explicit Yes continues. */
export function pageDropConfirmAccepted(closed: { result?: boolean } | undefined | null): boolean {
  return closed?.result === true;
}

export type PostSubmitEpisodeDialog = 'add-episode' | 'edit-episode' | 'none';

/**
 * After POST /submit: Created → Add Episode (curate the new row).
 * Enriched / already exists → Edit Episode. Podcast name stays read-only on Add Episode.
 */
export function postSubmitEpisodeDialog(episode: string | undefined): PostSubmitEpisodeDialog {
  if (episode === 'Created') {
    return 'add-episode';
  }
  if (episode === 'Enriched' || episode === 'EpisodeAlreadyExists') {
    return 'edit-episode';
  }
  return 'none';
}
