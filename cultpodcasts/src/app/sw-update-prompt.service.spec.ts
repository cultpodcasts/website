import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { SwUpdate, UnrecoverableStateEvent, VersionEvent } from '@angular/service-worker';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import {
  SW_BROKEN_PROMPT_MESSAGE,
  SW_UPDATE_ACTIVATE_TIMEOUT_MS,
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

const unrecoverableEvent: UnrecoverableStateEvent = { type: 'UNRECOVERABLE_STATE', reason: 'hash mismatch' };

/** A fake snackbar ref: `act()` clicks its action, `dismiss()` closes it (as Material does after an action). */
class FakeSnackBarRef {
  readonly action = new Subject<void>();
  readonly dismissed = new Subject<void>();
  constructor(private readonly bar: FakeSnackBar, readonly message: string, readonly actionLabel?: string) { }
  onAction() { return this.action; }
  afterDismissed() { return this.dismissed; }
  dismiss() {
    if (this.bar._openedSnackBarRef === this) {
      this.bar._openedSnackBarRef = null;
    }
    this.dismissed.next();
    this.dismissed.complete();
  }
  act() {
    this.action.next();
    this.dismiss();
  }
}

/** One snackbar at a time, like MatSnackBar: opening another dismisses the current one. */
class FakeSnackBar {
  _openedSnackBarRef: FakeSnackBarRef | null = null;
  readonly opened: FakeSnackBarRef[] = [];
  open = vi.fn((message: string, action?: string) => {
    this._openedSnackBarRef?.dismiss();
    const ref = new FakeSnackBarRef(this, message, action);
    this._openedSnackBarRef = ref;
    this.opened.push(ref);
    return ref;
  });
  get last(): FakeSnackBarRef | undefined { return this.opened[this.opened.length - 1]; }
}

describe('SwUpdatePromptService', () => {
  let versionUpdates: Subject<VersionEvent>;
  let unrecoverable: Subject<UnrecoverableStateEvent>;
  let checkForUpdate: ReturnType<typeof vi.fn>;
  let activateUpdate: ReturnType<typeof vi.fn>;
  let snackBar: FakeSnackBar;
  let dialog: { openDialogs: unknown[] };
  let service: SwUpdatePromptService;
  let reload: ReturnType<typeof vi.spyOn>;

  function setUp(options: { isEnabled?: boolean; platform?: string } = {}) {
    versionUpdates = new Subject<VersionEvent>();
    unrecoverable = new Subject<UnrecoverableStateEvent>();
    checkForUpdate = vi.fn(async () => false);
    activateUpdate = vi.fn(async () => true);
    snackBar = new FakeSnackBar();
    dialog = { openDialogs: [] };
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: PLATFORM_ID, useValue: options.platform ?? 'browser' },
        {
          provide: SwUpdate,
          useValue: { isEnabled: options.isEnabled ?? true, versionUpdates, unrecoverable, checkForUpdate, activateUpdate }
        },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: MatDialog, useValue: dialog }
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
    unrecoverable.next(unrecoverableEvent);
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(SW_UPDATE_CHECK_INTERVAL_MS);

    expect(checkForUpdate).not.toHaveBeenCalled();
    expect(snackBar.open).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
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
    expect(snackBar.open).toHaveBeenCalledTimes(1);
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
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());
  });

  it('on VERSION_READY shows a persistent New version available prompt with Reload', () => {
    setUp();
    service.start();

    versionUpdates.next({ type: 'VERSION_DETECTED', version: { hash: 'new' } } as VersionEvent);
    expect(snackBar.open).not.toHaveBeenCalled();

    versionUpdates.next(versionReady);

    expect(snackBar.open).toHaveBeenCalledExactlyOnceWith(SW_UPDATE_PROMPT_MESSAGE, SW_UPDATE_PROMPT_ACTION);
  });

  it('Reload activates the new version and then reloads the page', async () => {
    setUp();
    service.start();
    versionUpdates.next(versionReady);

    snackBar.last!.act();
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

    snackBar.last!.act();

    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
  });

  it('Reload still reloads when activation never settles, after the timeout', async () => {
    setUp();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    activateUpdate.mockReturnValue(new Promise<boolean>(() => undefined));
    service.start();
    versionUpdates.next(versionReady);

    snackBar.last!.act();
    await vi.advanceTimersByTimeAsync(SW_UPDATE_ACTIVATE_TIMEOUT_MS - 1);
    expect(reload).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not stack prompts while one is showing', () => {
    setUp();
    service.start();

    versionUpdates.next(versionReady);
    versionUpdates.next(versionReady);
    service.check(true);

    expect(snackBar.open).toHaveBeenCalledTimes(1);
  });

  it('offers a dismissed update again on the next interval check instead of asking the service worker', () => {
    setUp();
    service.start();
    versionUpdates.next(versionReady);
    snackBar.last!.dismiss();
    checkForUpdate.mockClear();

    vi.advanceTimersByTime(SW_UPDATE_CHECK_INTERVAL_MS);

    expect(snackBar.open).toHaveBeenCalledTimes(2);
    expect(checkForUpdate).not.toHaveBeenCalled();
  });

  it('re-offers a dismissed update on focus or visibility at most once per gap', () => {
    setUp();
    service.start();
    versionUpdates.next(versionReady);
    snackBar.last!.dismiss();

    window.dispatchEvent(new Event('focus'));
    expect(snackBar.open).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(SW_UPDATE_MIN_CHECK_GAP_MS);
    window.dispatchEvent(new Event('focus'));
    expect(snackBar.open).toHaveBeenCalledTimes(2);

    snackBar.last!.dismiss();
    window.dispatchEvent(new Event('focus'));
    expect(snackBar.open).toHaveBeenCalledTimes(2);
  });

  it('never replaces another snackbar that is showing; offers once it is dismissed', () => {
    setUp();
    service.start();
    const other = snackBar.open('Attached as trailer', 'Review');
    snackBar.open.mockClear();

    versionUpdates.next(versionReady);
    vi.advanceTimersByTime(SW_UPDATE_CHECK_INTERVAL_MS);
    expect(snackBar.open).not.toHaveBeenCalled();
    expect(snackBar._openedSnackBarRef).toBe(other);

    other.dismiss();

    expect(snackBar.open).toHaveBeenCalledExactlyOnceWith(SW_UPDATE_PROMPT_MESSAGE, SW_UPDATE_PROMPT_ACTION);
  });

  it('reloads at once on an unrecoverable state when no dialog is open', () => {
    setUp();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    service.start();

    unrecoverable.next(unrecoverableEvent);

    expect(reload).toHaveBeenCalledTimes(1);
    expect(snackBar.open).not.toHaveBeenCalled();
  });

  it('with a dialog open, an unrecoverable state prompts instead of reloading; Reload then reloads', () => {
    setUp();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    service.start();
    dialog.openDialogs.push({});

    unrecoverable.next(unrecoverableEvent);

    expect(reload).not.toHaveBeenCalled();
    expect(snackBar.open).toHaveBeenCalledExactlyOnceWith(SW_BROKEN_PROMPT_MESSAGE, SW_UPDATE_PROMPT_ACTION);

    snackBar.last!.act();

    expect(reload).toHaveBeenCalledTimes(1);
    expect(activateUpdate).not.toHaveBeenCalled();
  });

  it('with a dialog open, the needs-a-reload prompt replaces a waiting update prompt and is re-offered after dismissal', () => {
    setUp();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    service.start();
    versionUpdates.next(versionReady);
    dialog.openDialogs.push({});

    unrecoverable.next(unrecoverableEvent);

    expect(snackBar.opened.map(ref => ref.message)).toEqual([SW_UPDATE_PROMPT_MESSAGE, SW_BROKEN_PROMPT_MESSAGE]);
    expect(reload).not.toHaveBeenCalled();

    snackBar.last!.dismiss();
    vi.advanceTimersByTime(SW_UPDATE_CHECK_INTERVAL_MS);

    expect(snackBar.last!.message).toBe(SW_BROKEN_PROMPT_MESSAGE);
    expect(reload).not.toHaveBeenCalled();
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
