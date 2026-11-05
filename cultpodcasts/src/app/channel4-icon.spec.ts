import { svgIconLiterals } from './svg-icon-literals';
import { serviceDescriptor } from './service-catalog';

/**
 * Channel 4 service icon: official storefront favicon (black 4 on the lime tile).
 * Glyph paths must carry an explicit fill; inherited fill is white in the site chrome
 * and hides the 4 on #aaff89.
 */
const CHANNEL4_LIME = '#aaff89';
const CHANNEL4_MARK = '#000';

describe('Channel 4 service icon', () => {
  it('is generated as the lime tile with a black fill on every glyph path', () => {
    const svg = new Map(svgIconLiterals).get('channel4');
    expect(svg).toBeTruthy();
    expect(svg).toContain(`fill="${CHANNEL4_LIME}"`);
    const paths = svg!.match(/<path\b[^>]*>/g) ?? [];
    expect(paths).toHaveLength(9);
    for (const path of paths) {
      expect(path).toContain(`fill="${CHANNEL4_MARK}"`);
    }
    expect(serviceDescriptor('channel4').icon).toBe('channel4');
  });
});
