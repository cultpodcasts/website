import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const appDir = dirname(fileURLToPath(import.meta.url));
const styles = readFileSync(join(appDir, '../styles.scss'), 'utf8').replaceAll('\r\n', '\n');
const heroSass = readFileSync(
  join(appDir, 'homepage-hero/homepage-hero.component.sass'),
  'utf8',
).replaceAll('\r\n', '\n');
const badgeSass = readFileSync(
  join(appDir, 'content-kind-badge/content-kind-badge.component.sass'),
  'utf8',
).replaceAll('\r\n', '\n');

/** First `{ … }` body after `selector {` (brace-balanced, no nesting expected). */
function scssRuleBody(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `missing ${selector} rule`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`unclosed ${selector} rule`);
}

describe('hero series row (HERO-SER-*)', () => {
  const show = scssRuleBody(styles, '.hero-show');
  const pill = scssRuleBody(styles, '.hero-pill');

  it('HERO-SER-001: series row is block flex, full width, nowrap, 12px gap, centred', () => {
    expect(show).toMatch(/display:\s*flex\s*;/);
    expect(show).not.toMatch(/display:\s*inline-flex/);
    expect(show).toMatch(/flex-wrap:\s*nowrap/);
    expect(show).toMatch(/align-items:\s*center/);
    expect(show).toMatch(/gap:\s*12px/);
    expect(show).toMatch(/width:\s*100%/);
    expect(show).toMatch(/min-width:\s*0/);
  });

  it('HERO-SER-001: homepage copy column stacks eyebrow above series row (Firefox-safe)', () => {
    const copyStart = heroSass.indexOf('.billboard__copy\n');
    expect(copyStart).toBeGreaterThanOrEqual(0);
    const afterCopy = heroSass.slice(copyStart + '.billboard__copy\n'.length);
    const copyNext = afterCopy.search(/\n\.billboard__/);
    const copyBody = copyNext >= 0 ? afterCopy.slice(0, copyNext) : afterCopy;
    expect(copyBody).toMatch(/^\s+display: flex$/m);
    expect(copyBody).toMatch(/^\s+flex-direction: column$/m);

    const eyebrowStart = heroSass.indexOf('.billboard__eyebrow\n');
    expect(eyebrowStart).toBeGreaterThanOrEqual(0);
    const afterEyebrow = heroSass.slice(eyebrowStart + '.billboard__eyebrow\n'.length);
    const nextRule = afterEyebrow.search(/\n\.billboard__/);
    const eyebrowBody = nextRule >= 0 ? afterEyebrow.slice(0, nextRule) : afterEyebrow;
    expect(eyebrowBody).toMatch(/^\s+display: flex$/m);
    expect(eyebrowBody).not.toMatch(/display:\s*inline-flex/);
  });

  it('HERO-SER-003/004: series pill never wraps; long names ellipsize and may shrink', () => {
    expect(pill).toMatch(/white-space:\s*nowrap/);
    expect(pill).toMatch(/overflow:\s*hidden/);
    expect(pill).toMatch(/text-overflow:\s*ellipsis/);
    expect(pill).toMatch(/flex:\s*0 1 auto/);
    expect(pill).toMatch(/min-width:\s*0/);
  });

  it('HERO-SER-007: kind-badge host is inline-flex, not display:contents', () => {
    expect(badgeSass).toMatch(/:host\n\s+display: inline-flex/);
    expect(badgeSass).toMatch(/flex-shrink: 0/);
    expect(badgeSass).toMatch(/white-space: nowrap/);
    // Property form only — comments may mention contents as forbidden.
    expect(badgeSass).not.toMatch(/^\s*display:\s*contents\b/m);
    expect(badgeSass).toMatch(/:host:empty\n\s+display: none/);
    // Separator lived on the old eyebrow placement; badge sits alone on `.hero-show` now.
    expect(badgeSass).not.toMatch(/\.kind-badge__sep/);
  });
});
