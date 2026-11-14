import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { SwUpdate, UnrecoverableStateEvent, VersionEvent } from '@angular/service-worker';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import {
  SW_UPDATE_CHECK_INTERVAL_MS,
  SW_UPDATE_MIN_CHECK_GAP_MS,
  SW_UPDATE_PROMPT_ACTION,
  SW_UPDATE_PROMPT_MESSAGE,
  SwUpdatePromptService
} from './sw-update-prompt.service';

const versionReady = {
  type: 'VERSION_READY',
  currentVersion: { hash: 'old' },
  latestVersion: { hash: 'new' }
} as VersionEvent;

describe('SwUpdatePromptService', () => {
  let versionUpdates: Subject<VersionEvent>;
  let unrecoverable: Subject<UnrecoverableStateEvent>;
  let checkForUpdate: ReturnType<typeof vi.fn>;
  let activateUpdate: ReturnType<typeof vi.fn>;
  let open: ReturnType<typeof vi.fn>;
  let action: Subject<void>;
  let dismissed: Subject<void>;
  let service: SwUpdatePromptService;
  let reload: ReturnType<typeof vi.spyOn>;

  function setUp(options: { isEnabled?: boolean; platform?: string } = {}) {
    versionUpdates = new Subject<VersionEvent>();
    unrecoverable = new Subject<UnrecoverableStateEvent>();
    checkForUpdate = vi.fn(async () => false);
    activateUpdate = vi.fn(async () => true);
    action = new Subject<void>();
    dismissed = new Subject<void>();
    open = vi.fn(() => ({ onAction: () => action, afterDismissed: () => dismissed }));
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: PLATFORM_ID, useValue: options.platform ?? 'browser' },
        {
          provide: SwUpdate,
          useValue: { isEnabled: options.isEnabled ?? true, versionUpdates, unrecoverable, checkForUpdate, activateUpdate }
        },
        { provide: MatSnackBar, useValue: { open } }
      ]
    });
    service = TestBed.inject(SwUpdatePromptService);
    reload = vi.spyOn(service, 'reload').mockImplementation(() => undefined);
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('checks for a new build as soon as it starts', () => {
    setUp();

    service.start();

    expect(checkForUpdate).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the service worker is disabled (dev, tests, web views without service workers)', () => {
    setUp({ isEnabled: false });

    service.start();
    versionUpdates.next(versionReady);
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(SW_UPDATE_CHECK_INTERVAL_MS);

    expect(checkForUpdate).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it('does nothing on the server', () => {
    setUp({ platform: 'server' });

    service.start();

    expect(checkForUpdate).not.toHaveBeenCalled();
  });

  it('starts only once', () => {
    setUp();

    service.start();
    service.start();
    versionUpdates.next(versionReady);

    expect(checkForUpdate).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('checks again on every interval', () => {
    setUp();
    service.start();

    vi.advanceTimersByTime(SW_UPDATE_CHECK_INTERVAL_MS);
    vi.advanceTimersByTime(SW_UPDATE_CHECK_INTERVAL_MS);

    expect(checkForUpdate).toHaveBeenCalledTimes(3);
  });

  it('checks when the tab becomes visible or regains focus, at most once per gap', () => {
    setUp();
    service.start();
    const visibility = vi.spyOn(document, 'visibilityState', 'get');

    visibility.mockReturnValue('hidden');
    vi.advanceTimersByTime(SW_UPDATE_MIN_CHECK_GAP_MS);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(checkForUpdate).toHaveBeenCalledTimes(1);

    visibility.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(checkForUpdate).toHaveBeenCalledTimes(2);

    window.dispatchEvent(new Event('focus'));
    expect(checkForUpdate).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(SW_UPDATE_MIN_CHECK_GAP_MS);
    window.dispatchEvent(new Event('focus'));
    expect(checkForUpdate).toHaveBeenCalledTimes(3);
  });

  it('a failed check is logged, not thrown', async () => {
    setUp();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    checkForUpdate.mockRejectedValue(new Error('not ready'));

    service.start();
    await vi.runAllTicks();
    await Promise.resolve();

    expect(warn).toHaveBeenCalled();
  });

  it('on VERSION_READY shows a persistent New version available prompt with Reload', () => {
    setUp();
    service.start();

    versionUpdates.next({ type: 'VERSION_DETECTED', version: { hash: 'new' } } as VersionEvent);
    expect(open).not.toHaveBeenCalled();

    versionUpdates.next(versionReady);

    expect(open).toHaveBeenCalledExactlyOnceWith(SW_UPDATE_PROMPT_MESSAGE, SW_UPDATE_PROMPT_ACTION);
  });

  it('Reload activates the new version and then reloads the page', async () => {
    setUp();
    service.start();
    versionUpdates.next(versionReady);

    action.next();
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));

    expect(activateUpdate).toHaveBeenCalledTimes(1);
    expect(activateUpdate.mock.invocationCallOrder[0]).toBeLessThan(reload.mock.invocationCallOrder[0]);
  });

  it('Reload still reloads when activation fails', async () => {
    setUp();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    activateUpdate.mockRejectedValue(new Error('activation failed'));
    service.start();
    versionUpdates.next(versionReady);

    action.next();

    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it('does not stack prompts while one is showing', () => {
    setUp();
    service.start();

    versionUpdates.next(versionReady);
    versionUpdates.next(versionReady);
    service.check(true);

    expect(open).toHaveBeenCalledTimes(1);
  });

  it('offers a dismissed update again on the next check instead of asking the service worker', () => {
    setUp();
    service.start();
    versionUpdates.next(versionReady);
    dismissed.next();
    checkForUpdate.mockClear();

    vi.advanceTimersByTime(SW_UPDATE_CHECK_INTERVAL_MS);

    expect(open).toHaveBeenCalledTimes(2);
    expect(checkForUpdate).not.toHaveBeenCalled();
  });

  it('reloads at once on an unrecoverable service-worker state', () => {
    setUp();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    service.start();

    unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'hash mismatch' });

    expect(reload).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
  });

  it('stops checking once destroyed', () => {
    setUp();
    service.start();
    TestBed.resetTestingModule();

    vi.advanceTimersByTime(SW_UPDATE_CHECK_INTERVAL_MS);
    window.dispatchEvent(new Event('focus'));

    expect(checkForUpdate).toHaveBeenCalledTimes(1);
  });
});
