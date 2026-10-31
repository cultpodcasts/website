import { svgIconLiterals } from './svg-icon-literals';
import { serviceDescriptor } from './service-catalog';

/**
 * CBC Gem service icon: the live app-icon mark (white CBC gem on the Gem red tile, built from
 * tools/icon-sources/cbc-gem-logo.svg), not the old near-black tile with a "GEM" <text> wordmark.
 */
const GEM_RED = '#E60505';

describe('CBC Gem service icon', () => {
  it('is generated as the red app-icon tile with the white gem path, centred, and no <text>', () => {
    const svg = new Map(svgIconLiterals).get('cbc-gem');
    expect(svg).toBeTruthy();
    expect(svg).toContain('viewBox="0 0 24 24"');
    expect(svg).toContain(`<rect width="24" height="24" rx="5.4" fill="${GEM_RED}"/>`);
    expect(svg).not.toContain('<text');
    expect(svg).not.toContain('GEM');
    expect(svg!.match(/<path fill="#fff" /g)).toHaveLength(1);
    // Equal x/y translate: the 71.78-unit square gem is centred on (12, 12) at 14.1 px.
    const m = svg!.match(/matrix\(([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+)\)/);
    expect(m).toBeTruthy();
    const [scale, , tx, ty] = m!.slice(1).map(Number);
    expect(tx).toBe(ty);
    expect(Math.abs(tx + (0.03 + 71.81) / 2 * scale - 12)).toBeLessThan(0.05);
    expect(serviceDescriptor('cbcGem').icon).toBe('cbc-gem');
  });
});
