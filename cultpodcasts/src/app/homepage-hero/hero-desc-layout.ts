/**
 * Expanded hero description sizing (HERO-DSC-002), as a pure function so the component and the
 * hero layout harness (`e2e/hero-layout/`) size the expanded card with the same maths.
 *
 * Keep {@link expandedDescLayout} self-contained (no imports, no module references): the harness
 * serialises it into its setContent document with `Function.prototype.toString`.
 */
export interface HeroDescGrowBounds {
  /** Minimum growth in description lines (with {@link minVh}: max of the two). */
  readonly minLines: number;
  /** Minimum growth as a fraction of the viewport height. */
  readonly minVh: number;
  /** Maximum growth of the card (description + chevron band) as a fraction of the viewport height. */
  readonly maxVh: number;
  /** Margin the card keeps from the viewport foot when it fills to it. */
  readonly footMarginPx: number;
  /**
   * Height of the chevron band under the expanded description (HERO-DSC-003). Must match
   * the expanded `.billboard__desc-wrap` `padding-bottom` in `homepage-hero.component.sass`.
   */
  readonly toggleBandPx: number;
}

export const HERO_DESC_GROW: HeroDescGrowBounds = {
  minLines: 6,
  minVh: 0.3,
  maxVh: 0.6,
  footMarginPx: 12,
  toggleBandPx: 40,
};

/** Collapsed geometry captured at expand time (all px; `cardBottomVp` is viewport-relative). */
export interface HeroDescExpandMetrics {
  heroH: number;
  cardBottomVp: number;
  /** Collapsed description content height. */
  descH: number;
  /** Whole text height. */
  fullH: number;
  lineH: number;
  /** Wide: the card sits at the flex-end of a row hero, so it grows upward in flow. */
  bottomAnchored: boolean;
}

export interface HeroDescLayout {
  /** Hero height, locked at its collapsed value. */
  heroH: number;
  /** Expanded description height (the rest scrolls inside). */
  descPx: number;
  /** Wide: translateY that keeps the bottom-anchored card's top where it was. */
  shiftPx: number;
}

/**
 * The card's top never moves. Expanded, the card adds the description growth plus the chevron
 * band under it (B). The description grows by the gap G from the card's bottom to the viewport
 * foot (less the foot margin) minus B, so the card fills exactly to the foot; but by at least
 * max(minLines lines, minVh), so it always grows noticeably, and the card by at most maxVh in
 * total, so the chevron is never a long scroll away. Short text just shows in full.
 */
export function expandedDescLayout(m: HeroDescExpandMetrics, viewportH: number, b: HeroDescGrowBounds): HeroDescLayout {
  const band = b.toggleBandPx;
  const gap = viewportH - b.footMarginPx - m.cardBottomVp - band;
  const minGrow = Math.max(b.minLines * m.lineH, b.minVh * viewportH);
  const maxGrow = Math.max(minGrow, b.maxVh * viewportH - band);
  const grow = Math.min(Math.max(minGrow, gap), maxGrow);
  const descPx = Math.floor(Math.min(m.fullH, m.descH + grow));
  const shiftPx = m.bottomAnchored ? Math.round(descPx - m.descH + band) : 0;
  return { heroH: m.heroH, descPx, shiftPx };
}
