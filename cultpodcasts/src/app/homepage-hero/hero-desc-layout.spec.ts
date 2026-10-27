import { afterEach, describe, expect, it, vi } from 'vitest';
import { expandedDescLayout, HERO_DESC_GROW, measureCollapsedDesc, type HeroDescExpandMetrics } from './hero-desc-layout';

/**
 * HERO-DSC-002 / 003 sizing maths and measurement, shared by HomepageHeroComponent and the hero
 * layout harness (e2e/hero-layout/build-harness.ts serialises both functions).
 * Viewport 900, line 22px: minGrow = max(6 × 22, 30% × 900) = 270; maxGrow = 60% × 900 − 40 = 500.
 */
describe('expandedDescLayout (HERO-DSC-002 / 003)', () => {
  const metrics = (over: Partial<HeroDescExpandMetrics> = {}): HeroDescExpandMetrics => ({
    heroH: 720, cardBottomVp: 688, descH: 110, fullH: 2000, lineH: 22, bottomAnchored: false, ...over,
  });

  it('keeps the hero height', () => {
    expect(expandedDescLayout(metrics({ heroH: 640 }), 900, HERO_DESC_GROW).heroH).toBe(640);
  });

  it('near the foot: grows by at least max(6 lines, 30vh), even when the gap less the band is smaller', () => {
    // G = 900 - 12 - 688 - 40 = 160 < 270.
    expect(expandedDescLayout(metrics(), 900, HERO_DESC_GROW).descPx).toBe(380);
  });

  it('between the bounds: the card (text + 40px band) fills exactly to the foot less 12px', () => {
    // G = 900 - 12 - 488 - 40 = 360.
    const layout = expandedDescLayout(metrics({ cardBottomVp: 488 }), 900, HERO_DESC_GROW);
    expect(layout.descPx).toBe(470);
    expect(488 + (layout.descPx - 110) + HERO_DESC_GROW.toggleBandPx).toBe(900 - 12);
  });

  it('tall gap: the card grows at most 60vh, band included', () => {
    // G = 900 - 12 - 188 - 40 = 660 > 500.
    expect(expandedDescLayout(metrics({ cardBottomVp: 188 }), 900, HERO_DESC_GROW).descPx).toBe(610);
  });

  it('short text shows in full', () => {
    expect(expandedDescLayout(metrics({ fullH: 150 }), 900, HERO_DESC_GROW).descPx).toBe(150);
  });

  it('bottom-anchored (wide): shifts the card down by the text growth plus the band, so its top stays', () => {
    expect(expandedDescLayout(metrics({ bottomAnchored: true }), 900, HERO_DESC_GROW).shiftPx).toBe(380 - 110 + 40);
    expect(expandedDescLayout(metrics({ bottomAnchored: true, fullH: 150 }), 900, HERO_DESC_GROW).shiftPx).toBe(80);
    expect(expandedDescLayout(metrics(), 900, HERO_DESC_GROW).shiftPx).toBe(0);
  });

  it('a short viewport never caps growth below the minimum (maxGrow ≥ minGrow)', () => {
    // minGrow = max(240, 90) = 240; 60% × 300 − 40 = 140 → maxGrow = 240.
    const layout = expandedDescLayout(metrics({ cardBottomVp: 100, lineH: 40 }), 300, HERO_DESC_GROW);
    expect(layout.descPx).toBe(110 + 240);
  });

  it('is self-contained, so the harness can serialise it', () => {
    expect(expandedDescLayout.toString()).not.toMatch(/HERO_DESC_GROW|import|require\(/);
  });
});

describe('measureCollapsedDesc (HERO-DSC-002)', () => {
  afterEach(() => vi.restoreAllMocks());

  function rig(flexDirection: string) {
    const hero = document.createElement('section');
    const card = document.createElement('div');
    const desc = document.createElement('p');
    vi.spyOn(hero, 'getBoundingClientRect').mockReturnValue({ height: 720 } as DOMRect);
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({ bottom: 688 } as DOMRect);
    Object.defineProperty(desc, 'scrollHeight', { value: 1210 });
    const real = window.getComputedStyle.bind(window);
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element) => {
      if (el === desc) {
        return { height: '110px', paddingTop: '4px', paddingBottom: '6px', lineHeight: '22px' } as CSSStyleDeclaration;
      }
      if (el === hero) {
        return { flexDirection } as CSSStyleDeclaration;
      }
      return real(el);
    });
    return { hero, card, desc };
  }

  it('reads the collapsed hero, card bottom, description content / whole-text / line heights', () => {
    const { hero, card, desc } = rig('row');
    expect(measureCollapsedDesc(hero, card, desc)).toEqual({
      heroH: 720, cardBottomVp: 688, descH: 110, fullH: 1200, lineH: 22, bottomAnchored: true,
    });
  });

  it('stacked (column) hero: the card is not bottom-anchored', () => {
    const { hero, card, desc } = rig('column');
    expect(measureCollapsedDesc(hero, card, desc).bottomAnchored).toBe(false);
  });

  it('is self-contained, so the harness can serialise it', () => {
    expect(measureCollapsedDesc.toString()).not.toMatch(/HERO_DESC_GROW|import|require\(/);
  });
});
