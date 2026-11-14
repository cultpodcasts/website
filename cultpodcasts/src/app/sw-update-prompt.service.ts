import { DestroyRef, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { SwUpdate, UnrecoverableStateEvent, VersionReadyEvent } from '@angular/service-worker';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { filter } from 'rxjs';

/** How often an open tab asks the service worker whether a new build has been deployed. */
export const SW_UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000;
/** Focus and visibility changes come in bursts; at most one check per this window. */
export const SW_UPDATE_MIN_CHECK_GAP_MS = 60 * 1000;

export const SW_UPDATE_PROMPT_MESSAGE = 'New version available';
export const SW_UPDATE_PROMPT_ACTION = 'Reload';

/**
 * Keeps open tabs and installed app windows on the latest deployed build (#666).
 *
 * The Angular service worker serves the cached build until it is told to switch, so without this an open tab (or a
 * plain reload of one) can keep running an old version after a deploy. This service:
 * - checks for a new build on start, every {@link SW_UPDATE_CHECK_INTERVAL_MS}, and when the tab becomes visible or
 *   regains focus (throttled to one check per {@link SW_UPDATE_MIN_CHECK_GAP_MS});
 * - on `VERSION_READY` shows a persistent "New version available" snackbar whose Reload action activates the new
 *   version and reloads; if the prompt is dismissed or replaced by another snackbar, it is shown again on the next
 *   check;
 * - on an unrecoverable service-worker state, reloads the page straight away (the cached build cannot be served).
 *
 * It does nothing during SSR, or when the service worker is unavailable or disabled (`SwUpdate.isEnabled` is false:
 * tests, browsers or web views without service workers such as the iOS app's WKWebView, insecure origins).
 */
@Injectable({ providedIn: 'root' })
export class SwUpdatePromptService {
  /** Absent when no service worker is provided (specs, some app configs). */
  private readonly swUpdate = inject(SwUpdate, { optional: true });
  private readonly snackBar = inject(MatSnackBar);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  private started = false;
  private updateReady = false;
  private prompt: MatSnackBarRef<TextOnlySnackBar> | null = null;
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

    swUpdate.unrecoverable.subscribe((event: UnrecoverableStateEvent) => {
      console.error('Service worker is in an unrecoverable state; reloading.', event.reason);
      this.reload();
    });

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
   * Asks the service worker for a new build. An update already waiting is offered again instead (the prompt may have
   * been dismissed or pushed out by another snackbar). `force` skips the focus/visibility throttle.
   */
  check(force = false): void {
    if (this.updateReady) {
      this.showPrompt();
      return;
    }
    const now = Date.now();
    if (!force && now - this.lastCheck < SW_UPDATE_MIN_CHECK_GAP_MS) {
      return;
    }
    this.lastCheck = now;
    this.swUpdate?.checkForUpdate().catch(e => console.warn('Service worker update check failed.', e));
  }

  /** Activates the waiting version, then reloads into it. A failed activation still reloads (to the newest it can). */
  async applyUpdate(): Promise<void> {
    try {
      await this.swUpdate?.activateUpdate();
    } catch (e) {
      console.error('Service worker update activation failed; reloading anyway.', e);
    }
    this.reload();
  }

  /** Full page reload. Separate so specs can observe it. */
  reload(): void {
    this.document.location.reload();
  }

  private showPrompt(): void {
    if (this.prompt) {
      return;
    }
    const prompt = this.snackBar.open(SW_UPDATE_PROMPT_MESSAGE, SW_UPDATE_PROMPT_ACTION);
    this.prompt = prompt;
    prompt.onAction().subscribe(() => void this.applyUpdate());
    prompt.afterDismissed().subscribe(() => {
      if (this.prompt === prompt) {
        this.prompt = null;
      }
    });
  }
}
