/**
 * Shared pieces of the hero description expander: the homepage "Now featuring" hero
 * (HERO-DSC-001) and the item page hero (app-hero-description on the episode, film,
 * TV episode and news report pages). Same labels, icons and overflow rule in both.
 */

/** Accessible name of the description expander. */
export enum HeroDescToggleLabel {
  Expand = 'Expand description',
  Collapse = 'Collapse description',
}

/** Material icon ligature on the description expander. */
export enum HeroDescToggleIcon {
  Expand = 'expand_more',
  Collapse = 'expand_less',
}

export function heroDescToggleLabel(expanded: boolean): HeroDescToggleLabel {
  return expanded ? HeroDescToggleLabel.Collapse : HeroDescToggleLabel.Expand;
}

export function heroDescToggleIcon(expanded: boolean): HeroDescToggleIcon {
  return expanded ? HeroDescToggleIcon.Collapse : HeroDescToggleIcon.Expand;
}

/**
 * True when a line-clamped element hides text (more than a 1px rounding slop).
 * Only meaningful while the clamp is on.
 */
export function clampOverflows(element: Pick<HTMLElement, 'scrollHeight' | 'clientHeight'>): boolean {
  return element.scrollHeight - element.clientHeight > 1;
}