import { DestroyRef, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { SwUpdate, UnrecoverableStateEvent, VersionReadyEvent } from '@angular/service-worker';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { filter, take } from 'rxjs';

/** How often an open tab asks the service worker whether a new build has been deployed. */
export const SW_UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;
/** Focus and visibility changes come in bursts; at most one check (or re-offer of a waiting prompt) per this window. */
export const SW_UPDATE_MIN_CHECK_GAP_MS = 60 * 1000;
/** Reload waits at most this long for the service worker to activate the new version, then reloads anyway. */
export const SW_UPDATE_ACTIVATE_TIMEOUT_MS = 3000;

export const SW_UPDATE_PROMPT_MESSAGE = 'New version available';
export const SW_BROKEN_PROMPT_MESSAGE = 'This page needs a reload to keep working';
export const SW_UPDATE_PROMPT_ACTION = 'Reload';

type PromptKind = 'update' | 'broken';

/**
 * Keeps open tabs and installed app windows on the latest deployed build (#666).
 *
 * The Angular service worker serves the cached build until it is told to switch, so without this an open tab (or a
 * plain reload of one) can keep running an old version after a deploy. This service:
 * - checks for a new build on start, every {@link SW_UPDATE_CHECK_INTERVAL_MS}, and when the tab becomes visible or
 *   regains focus (throttled to one check per {@link SW_UPDATE_MIN_CHECK_GAP_MS});
 * - on `VERSION_READY` shows a persistent "New version available" snackbar whose Reload action activates the new
 *   version (waiting at most {@link SW_UPDATE_ACTIVATE_TIMEOUT_MS}) and reloads. If the prompt is dismissed it is
 *   offered again on a later check, at the same throttle;
 * - on an unrecoverable service-worker state reloads at once only when no dialog is open; with a dialog open (unsaved
 *   work) it shows a persistent "This page needs a reload to keep working" snackbar with Reload instead.
 *
 * A prompt never replaces another snackbar that is showing (e.g. "Attached as trailer"): it waits for that one to be
 * dismissed.
 *
 * It does nothing during SSR, or when the service worker is unavailable or disabled (`SwUpdate.isEnabled` is false:
 * tests, browsers or web views without service workers such as the iOS app's WKWebView, insecure origins).
 */
@Injectable({ providedIn: 'root' })
export class SwUpdatePromptService {
  /** Absent when no service worker is provided (specs, some app configs). */
  private readonly swUpdate = inject(SwUpdate, { optional: true });
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  private started = false;
  private updateReady = false;
  private broken = false;
  private prompt: MatSnackBarRef<TextOnlySnackBar> | null = null;
  private promptKind: PromptKind | null = null;
  private waitingForOtherSnackBar = false;
  private lastCheck = Number.NEGATIVE_INFINITY;

  /** Starts watching for new builds. Safe to call more than once and on any platform. */
  start(): void {
    if (this.started || !isPlatformBrowser(this.platformId) || !this.swUpdate?.isEnabled) {
      return;
    }
    this.started = true;
    const swUpdate = this.swUpdate;

    swUpdate.versionUpdates
      .pipe(filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'))
      .subscribe(() => {
        this.updateReady = true;
        this.showPrompt();
      });

    swUpdate.unrecoverable.subscribe((event: UnrecoverableStateEvent) => this.onUnrecoverable(event));

    const view = this.document.defaultView;
    const timer = view?.setInterval(() => this.check(true), SW_UPDATE_CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (this.document.visibilityState === 'visible') {
        this.check();
      }
    };
    const onFocus = () => this.check();
    this.document.addEventListener('visibilitychange', onVisible);
    view?.addEventListener('focus', onFocus);
    this.destroyRef.onDestroy(() => {
      if (timer !== undefined) {
        view?.clearInterval(timer);
      }
      this.document.removeEventListener('visibilitychange', onVisible);
      view?.removeEventListener('focus', onFocus);
    });

    this.check(true);
  }

  /**
   * Asks the service worker for a new build, or re-offers a prompt that is waiting (dismissed earlier). Focus and
   * visibility calls are throttled to one per {@link SW_UPDATE_MIN_CHECK_GAP_MS}; `force` (start, interval) skips it.
   */
  check(force = false): void {
    const now = Date.now();
    if (!force && now - this.lastCheck < SW_UPDATE_MIN_CHECK_GAP_MS) {
      return;
    }
    this.lastCheck = now;
    if (this.broken || this.updateReady) {
      this.showPrompt();
      return;
    }
    this.swUpdate?.checkForUpdate().catch(e => console.warn('Service worker update check failed.', e));
  }

  /**
   * Activates the waiting version, then reloads into it. A failed activation, or one that takes longer than
   * {@link SW_UPDATE_ACTIVATE_TIMEOUT_MS}, still reloads.
   */
  async applyUpdate(): Promise<void> {
    const view = this.document.defaultView;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<'timeout'>(resolve => {
      timer = (view ?? globalThis).setTimeout(() => resolve('timeout'), SW_UPDATE_ACTIVATE_TIMEOUT_MS);
    });
    try {
      const outcome = await Promise.race([this.swUpdate?.activateUpdate() ?? Promise.resolve(false), timeout]);
      if (outcome === 'timeout') {
        console.warn('Service worker update activation timed out; reloading anyway.');
      }
    } catch (e) {
      console.error('Service worker update activation failed; reloading anyway.', e);
    } finally {
      (view ?? globalThis).clearTimeout(timer);
    }
    this.reload();
  }

  /** Full page reload. Separate so specs can observe it. */
  reload(): void {
    this.document.location.reload();
  }

  /**
   * The cached build can no longer be served (e.g. lazy chunks gone), but the page in memory still works. Reload at
   * once only when nothing is open; with a dialog open, let the curator finish and reload from the prompt.
   */
  private onUnrecoverable(event: UnrecoverableStateEvent): void {
    console.error('Service worker is in an unrecoverable state.', event.reason);
    if (this.dialog.openDialogs.length === 0) {
      this.reload();
      return;
    }
    this.broken = true;
    if (this.prompt && this.promptKind !== 'broken') {
      // Swap the update prompt for the more urgent one once it is gone.
      this.prompt.dismiss();
      return;
    }
    this.showPrompt();
  }

  private showPrompt(): void {
    if (this.prompt || this.waitingForOtherSnackBar) {
      return;
    }
    const other = this.snackBar._openedSnackBarRef;
    if (other) {
      // Never replace a toast the curator may still be reading; offer once it is dismissed.
      this.waitingForOtherSnackBar = true;
      other.afterDismissed().pipe(take(1)).subscribe(() => {
        this.waitingForOtherSnackBar = false;
        this.showPrompt();
      });
      return;
    }
    const kind: PromptKind = this.broken ? 'broken' : 'update';
    const prompt = this.snackBar.open(
      kind === 'broken' ? SW_BROKEN_PROMPT_MESSAGE : SW_UPDATE_PROMPT_MESSAGE,
      SW_UPDATE_PROMPT_ACTION);
    this.prompt = prompt;
    this.promptKind = kind;
    prompt.onAction().subscribe(() => kind === 'broken' ? this.reload() : void this.applyUpdate());
    prompt.afterDismissed().subscribe(() => {
      if (this.prompt === prompt) {
        this.prompt = null;
        this.promptKind = null;
        if (this.broken && kind !== 'broken') {
          this.showPrompt();
        }
      }
    });
  }
}
