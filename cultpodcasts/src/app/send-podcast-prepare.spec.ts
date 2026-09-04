import { describe, expect, it, vi } from 'vitest';
import { ShareMode } from './share-mode.enum';
import { Share } from './share.interface';
import {
  resolveSendPodcastPrepare,
  runSendPodcastPrepareFlow,
  shouldBeginBusyBeforePrepare
} from './send-podcast-prepare';

const baseShare: Share = {
  url: new URL('https://open.spotify.com/episode/0exampleepisode00'),
  podcastId: undefined,
  podcastName: undefined,
  shareMode: ShareMode.Text
};

describe('shouldBeginBusyBeforePrepare', () => {
  it('begins busy before prepare only when a prepare callback is provided', () => {
    expect(shouldBeginBusyBeforePrepare(undefined)).toBe(false);
    expect(shouldBeginBusyBeforePrepare(async () => undefined)).toBe(true);
  });
});

describe('resolveSendPodcastPrepare', () => {
  it('passes share through unchanged when there is no prepare', async () => {
    await expect(resolveSendPodcastPrepare(baseShare)).resolves.toEqual({
      action: 'submit',
      share: baseShare
    });
  });

  it('closes without submit when prepare returns cancelled', async () => {
    await expect(
      resolveSendPodcastPrepare(baseShare, async () => 'cancelled')
    ).resolves.toEqual({ action: 'cancelled' });
  });

  it('reports prepare error without treating it as submit failure', async () => {
    await expect(
      resolveSendPodcastPrepare(baseShare, async () => 'error')
    ).resolves.toEqual({ action: 'error' });
  });

  it('merges prepared podcastId and podcastName onto share before submit', async () => {
    const resolved = await resolveSendPodcastPrepare(baseShare, async () => ({
      podcastId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      podcastName: 'Prepared Show'
    }));
    expect(resolved).toEqual({
      action: 'submit',
      share: {
        ...baseShare,
        podcastId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        podcastName: 'Prepared Show'
      }
    });
  });

  it('maps unexpected prepare throws to error instead of rethrowing', async () => {
    const err = new Error('lookup blew up');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await expect(
        resolveSendPodcastPrepare(baseShare, async () => {
          throw err;
        })
      ).resolves.toEqual({ action: 'error' });
      expect(spy).toHaveBeenCalledWith(err);
    } finally {
      spy.mockRestore();
    }
  });
});

describe('runSendPodcastPrepareFlow', () => {
  it('sets beginBusy before prepare settles, then submits merged share', async () => {
    const order: string[] = [];
    let submitShare: Share | undefined;
    let prepareStarted = false;

    await runSendPodcastPrepareFlow(
      baseShare,
      async () => {
        prepareStarted = true;
        order.push('prepare');
        expect(order[0]).toBe('busy');
        return {
          podcastId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          podcastName: 'Looked Up Show'
        };
      },
      {
        beginBusy: () => order.push('busy'),
        submit: async share => {
          order.push('submit');
          submitShare = share;
        },
        onCancelled: () => order.push('cancelled'),
        onPrepareError: () => order.push('prepare-error'),
        onSubmitError: () => order.push('submit-error')
      }
    );

    expect(prepareStarted).toBe(true);
    expect(order).toEqual(['busy', 'prepare', 'submit']);
    expect(submitShare).toEqual({
      ...baseShare,
      podcastId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      podcastName: 'Looked Up Show'
    });
  });

  it('cancels without calling submit', async () => {
    const submit = vi.fn();
    const onCancelled = vi.fn();
    await runSendPodcastPrepareFlow(
      baseShare,
      async () => 'cancelled',
      {
        beginBusy: () => undefined,
        submit,
        onCancelled,
        onPrepareError: () => undefined,
        onSubmitError: () => undefined
      }
    );
    expect(onCancelled).toHaveBeenCalledOnce();
    expect(submit).not.toHaveBeenCalled();
  });

  it('does not call beginBusy when there is no prepare (submit owns POST busy)', async () => {
    const beginBusy = vi.fn();
    const submit = vi.fn(async () => undefined);
    await runSendPodcastPrepareFlow(baseShare, undefined, {
      beginBusy,
      submit,
      onCancelled: () => undefined,
      onPrepareError: () => undefined,
      onSubmitError: () => undefined
    });
    expect(beginBusy).not.toHaveBeenCalled();
    expect(submit).toHaveBeenCalledWith(baseShare);
  });

  it('routes prepare error to onPrepareError, not onSubmitError', async () => {
    const onPrepareError = vi.fn();
    const onSubmitError = vi.fn();
    const submit = vi.fn();
    await runSendPodcastPrepareFlow(
      baseShare,
      async () => 'error',
      {
        beginBusy: () => undefined,
        submit,
        onCancelled: () => undefined,
        onPrepareError,
        onSubmitError
      }
    );
    expect(onPrepareError).toHaveBeenCalledOnce();
    expect(onSubmitError).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });
});
