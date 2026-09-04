import { parseSubmittablePodcastUrl } from './podcast-url-matcher';
import { SubmitUrlLookupResponse } from './submit-url-lookup.interface';
import { SubmitSeriesSelection } from './submit-series.util';

/**
 * Worker public gate: Auth0 roles with submit backend access (`Submitter`, `Curator`).
 * Signed-out users never call GET /submit/lookup.
 */
export function shouldCallSubmitUrlLookup(
  roles: readonly string[] | null | undefined
): boolean {
  return !!roles?.includes('Submitter') || !!roles?.includes('Curator');
}

/**
 * After lookup: unknown streaming URLs need POST /submit/prepare for show name (no scrape on lookup).
 */
export function shouldCallSubmitUrlPrepare(
  lookup: SubmitUrlLookupResponse | 'error' | null
): boolean {
  return (
    !!lookup &&
    lookup !== 'error' &&
    !lookup.known &&
    !lookup.ambiguous &&
    lookup.kind === 'streaming'
  );
}

/**
 * Homepage general drop / share after GET /submit/lookup (Submitter/Curator).
 * Known unique or unknown podcast-service → URL-only (platform metadata / stored membership).
 * Unknown streaming → persist podcastName from prepare (or lookup if already present).
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

/** Signed-out general drop / share / Add Podcast: URL-only POST, never lookup-derived names. */
export function generalDropSeriesForActor(
  roles: readonly string[] | null | undefined,
  lookup: SubmitUrlLookupResponse | 'error' | null
): SubmitSeriesSelection {
  if (!shouldCallSubmitUrlLookup(roles)) {
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

/** Add Podcast closes with a form string; drop/share already have a URL. */
export function parseSubmitDialogUrl(raw: unknown): URL | undefined {
  if (raw == null || raw === '') {
    return undefined;
  }
  const text = raw instanceof URL ? raw.href : String(raw);
  return parseSubmittablePodcastUrl(text) ?? undefined;
}

export type PodcastPageAttachResult =
  | { kind: 'send'; url: URL; podcastId: string; podcastName: string | undefined }
  | { kind: 'abort'; reason: 'no-url' | 'unparseable' | 'resolve' | 'cancelled' | 'declined' };

export type PodcastPageResolveOutcome =
  | { kind: 'selection'; selection: { podcastId?: string; podcastName?: string } }
  | { kind: 'cancelled' }
  | { kind: 'error' };

/**
 * Submit Url for Podcast: ignore typed Series, parse the close payload,
 * attach to the page id, and confirm when lookup says another series owns the URL.
 */
export async function podcastPageAttachAfterDialog(args: {
  rawUrl: unknown;
  pagePodcastName: string;
  lookupHref: (href: string) => Promise<SubmitUrlLookupResponse | 'error'>;
  resolvePage: (name: string) => Promise<PodcastPageResolveOutcome>;
  confirmOther: (
    lookup: SubmitUrlLookupResponse | 'error',
    pagePodcastId: string,
    pagePodcastName: string
  ) => Promise<boolean>;
}): Promise<PodcastPageAttachResult> {
  if (args.rawUrl == null || args.rawUrl === '') {
    return { kind: 'abort', reason: 'no-url' };
  }
  const url = parseSubmitDialogUrl(args.rawUrl);
  if (!url) {
    return { kind: 'abort', reason: 'unparseable' };
  }
  const outcome = await args.resolvePage(args.pagePodcastName);
  if (outcome.kind !== 'selection' || !outcome.selection.podcastId) {
    return { kind: 'abort', reason: outcome.kind === 'cancelled' ? 'cancelled' : 'resolve' };
  }
  let lookup: SubmitUrlLookupResponse | 'error';
  try {
    lookup = await args.lookupHref(url.href);
  } catch {
    lookup = 'error';
  }
  const pagePodcastId = outcome.selection.podcastId;
  const pagePodcastName = outcome.selection.podcastName ?? args.pagePodcastName;
  const proceed = await args.confirmOther(lookup, pagePodcastId, pagePodcastName);
  if (!proceed) {
    return { kind: 'abort', reason: 'declined' };
  }
  return {
    kind: 'send',
    url,
    podcastId: pagePodcastId,
    podcastName: outcome.selection.podcastName
  };
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

/** Curator-only — episode Add/Edit dialogs require `curate` scope. */
export function postSubmitEpisodeDialogForActor(
  roles: readonly string[] | null | undefined,
  episode: string | undefined
): PostSubmitEpisodeDialog {
  if (!roles?.includes('Curator')) {
    return 'none';
  }
  return postSubmitEpisodeDialog(episode);
}
