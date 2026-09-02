import { SubmitUrlLookupResponse } from './submit-url-lookup.interface';
import { SubmitSeriesSelection } from './submit-series.util';

/** General drop / share: Cult Podcasts matches the series. Never send Series fields. */
export function generalDropSeries(): SubmitSeriesSelection {
  return { podcastId: undefined, podcastName: undefined };
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
