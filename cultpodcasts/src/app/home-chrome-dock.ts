/**
 * Wide homepage: when does the dropped search dock into the logo bar?
 *
 * The dropped field is `position: sticky` with `margin-top: bar-h + gap` and
 * `top: (bar-h - search-h) / 2`, all from CSS variables. It catches in the bar
 * at `pinY = slotTop + bar-h + gap - stickTop` (document Y). Docking and
 * undocking are both decided against that one value, with a small band in
 * between where the current state is kept, so the frosted bar cannot flip on
 * every frame.
 *
 * Do not mix in measured heights (the rendered toolbar can be taller than
 * `--site-chrome-bar-h`): that put the dock line and the undock line a few px
 * apart in opposite directions, and every scroll frame in between toggled the
 * state (dark bar, transparent, dark…). CHROME-DOCK-012.
 */
export interface HomeDockMetrics {
  /** Document Y of `.chrome-search-slot` (stays in flow; holds the dropped height). */
  slotTop: number;
  /** `--site-chrome-bar-h` */
  barHeight: number;
  /** `--site-chrome-search-gap` */
  gap: number;
  /** `--nflx-search-h` */
  searchHeight: number;
}

/** Dock once within this many px of the pin (sub-pixel / fractional scrollY). */
export const HOME_DOCK_ENTER_SLACK_PX = 1;
/** Undock only this far below the pin, so the two lines never cross. */
export const HOME_DOCK_EXIT_SLACK_PX = 3;

/** CSS sticky `top` of the dropped field (viewport Y once caught in the bar). */
export function homeStickTopPx(m: Pick<HomeDockMetrics, 'barHeight' | 'searchHeight'>): number {
  return Math.max(0, (m.barHeight - m.searchHeight) / 2);
}

/** scrollY at which the sticky field reaches its in-bar position. */
export function homePinScrollY(m: HomeDockMetrics): number {
  return m.slotTop + m.barHeight + m.gap - homeStickTopPx(m);
}

/** Next docked state for a scroll position. Same pin for both directions; hysteresis between. */
export function nextHomeDocked(docked: boolean, scrollY: number, pinY: number): boolean {
  if (docked) {
    return scrollY >= pinY - HOME_DOCK_EXIT_SLACK_PX;
  }
  return scrollY >= pinY - HOME_DOCK_ENTER_SLACK_PX;
}

function cssPx(styles: CSSStyleDeclaration, name: string, fallback: number): number {
  const value = Number.parseFloat(styles.getPropertyValue(name));
  return Number.isFinite(value) ? value : fallback;
}

/** Read the dock metrics from the shell's CSS variables and the in-flow slot. */
export function readHomeDockMetrics(shell: Element, slot: Element, scrollY: number): HomeDockMetrics {
  const styles = getComputedStyle(shell);
  return {
    slotTop: slot.getBoundingClientRect().top + scrollY,
    barHeight: cssPx(styles, '--site-chrome-bar-h', 58),
    gap: cssPx(styles, '--site-chrome-search-gap', 12),
    searchHeight: cssPx(styles, '--nflx-search-h', 48),
  };
}
