import { DestroyRef } from '@angular/core';

/** Shared by Discovery / Outgoing / Episodes curator grids. */
export const CURATOR_SNAP_CLASS = 'curator-snap-enabled';
export const CURATOR_SNAP_OFFSET_VAR = '--curator-snap-offset';

export function toggleCuratorSnapClass(enabled: boolean): void {
  if (typeof document === 'undefined') {
    return;
  }

  const method: 'add' | 'remove' = enabled ? 'add' : 'remove';
  // CSS only keys off html.curator-snap-enabled (see styles.scss).
  document.documentElement.classList[method](CURATOR_SNAP_CLASS);
  if (!enabled) {
    document.documentElement.style.removeProperty(CURATOR_SNAP_OFFSET_VAR);
  }
}

/**
 * Enabling snap + scroll-padding on first paint makes the browser nudge scroll
 * (and can dock/undock chrome). Arm only after the user has scrolled a little.
 */
export function armCuratorSnapAfterScroll(
  destroyRef: DestroyRef,
  onArmed: () => void
): void {
  const arm = () => {
    toggleCuratorSnapClass(true);
    onArmed();
  };

  if (window.scrollY > 8) {
    arm();
    return;
  }

  const onScroll = () => {
    if (window.scrollY <= 8) {
      return;
    }
    window.removeEventListener('scroll', onScroll);
    arm();
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  destroyRef.onDestroy(() => window.removeEventListener('scroll', onScroll));
}

export function syncCuratorSnapOffset(toolbar: HTMLElement | undefined | null): void {
  if (typeof document === 'undefined' || !toolbar) {
    return;
  }
  const chromeSource = document.getElementById('body') ?? document.documentElement;
  const chromeH = parseFloat(
    getComputedStyle(chromeSource).getPropertyValue('--site-chrome-bar-h')
  ) || 58;
  // Match sticky top: calc(var(--site-chrome-bar-h) + 4px) plus toolbar + gap.
  const offset = Math.ceil(toolbar.getBoundingClientRect().height) + Math.ceil(chromeH) + 4 + 8;
  document.documentElement.style.setProperty(CURATOR_SNAP_OFFSET_VAR, `${offset}px`);
}

export function observeCuratorSnapToolbar(
  toolbar: HTMLElement | undefined | null
): ResizeObserver | undefined {
  if (!toolbar || typeof ResizeObserver === 'undefined') {
    return undefined;
  }

  const observer = new ResizeObserver(() => {
    if (document.documentElement.classList.contains(CURATOR_SNAP_CLASS)) {
      syncCuratorSnapOffset(toolbar);
    }
  });
  observer.observe(toolbar);
  return observer;
}
