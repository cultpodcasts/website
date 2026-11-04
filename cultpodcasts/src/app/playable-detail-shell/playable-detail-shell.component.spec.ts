import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const shellDir = dirname(fileURLToPath(import.meta.url));
const shellSass = readFileSync(join(shellDir, 'playable-detail-shell.component.sass'), 'utf8').replaceAll(
  '\r\n',
  '\n',
);

describe('PlayableDetailShellComponent Sass contracts', () => {
  it('keeps the Firefox soft-wash on episode backdrop edges (no scaleX streak path)', () => {
    // Same fragile CSS as homepage hero-stage — item pages must lock it independently.
    expect(shellSass).toMatch(/@supports \(-moz-appearance: none\)[\s\S]*?transform: none/);
    expect(shellSass).toMatch(/@supports \(-moz-appearance: none\)[\s\S]*?blur\(36px\)/);
  });
});
