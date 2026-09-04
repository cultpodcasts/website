import { Share } from './share.interface';

/** Result of optional pre-submit work (lookup / series merge). Prefer these over throwing. */
export type SendPodcastPrepareOutcome =
  | Pick<Share, 'podcastId' | 'podcastName'>
  | 'cancelled'
  | 'error'
  | void;

export type SendPodcastPrepareResolution =
  | { action: 'submit'; share: Share }
  | { action: 'cancelled' }
  | { action: 'error' };

/**
 * True when toolbar should call `beginBusy()` before awaiting prepare (spinner during
 * silent lookup on general drop/share). When false, `submit()` alone owns busy for POST.
 */
export function shouldBeginBusyBeforePrepare(
  prepare?: () => Promise<SendPodcastPrepareOutcome>
): boolean {
  return prepare != null;
}

/**
 * Runs optional prepare and merges series onto share. Unexpected throws become `error`
 * (not submit-error); callers should return `'cancelled' | 'error'` instead of throwing.
 */
export async function resolveSendPodcastPrepare(
  share: Share,
  prepare?: () => Promise<SendPodcastPrepareOutcome>
): Promise<SendPodcastPrepareResolution> {
  if (!prepare) {
    return { action: 'submit', share };
  }
  try {
    const prepared = await prepare();
    if (prepared === 'cancelled') {
      return { action: 'cancelled' };
    }
    if (prepared === 'error') {
      return { action: 'error' };
    }
    if (prepared) {
      return { action: 'submit', share: { ...share, ...prepared } };
    }
    return { action: 'submit', share };
  } catch (e) {
    console.error(e);
    return { action: 'error' };
  }
}

export type SendPodcastPrepareFlowHooks = {
  beginBusy: () => void;
  submit: (share: Share) => Promise<void>;
  onCancelled: () => void;
  onPrepareError: () => void;
  onSubmitError: (error: unknown) => void;
};

/**
 * Orchestrates early-busy → prepare → submit. Used by ToolbarComponent.sendPodcast;
 * extracted so Vitest can assert cancel / merge / busy-before-await without MatDialog.
 */
export async function runSendPodcastPrepareFlow(
  share: Share,
  prepare: (() => Promise<SendPodcastPrepareOutcome>) | undefined,
  hooks: SendPodcastPrepareFlowHooks
): Promise<void> {
  if (shouldBeginBusyBeforePrepare(prepare)) {
    hooks.beginBusy();
  }
  const resolved = await resolveSendPodcastPrepare(share, prepare);
  if (resolved.action === 'cancelled') {
    hooks.onCancelled();
    return;
  }
  if (resolved.action === 'error') {
    hooks.onPrepareError();
    return;
  }
  try {
    await hooks.submit(resolved.share);
  } catch (e) {
    hooks.onSubmitError(e);
  }
}
