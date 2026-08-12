import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('site chrome docked search (privacy-policy cold load)', () => {
  const sass = readFileSync(
    join(__dirname, 'app.component.sass'),
    'utf8'
  );
  const toolbarTs = readFileSync(
    join(__dirname, 'toolbar/toolbar.component.ts'),
    'utf8'
  );

  it('CHROME-DOCK-001: docked search wrapper uses pointer-events none so add/profile stay clickable under z-index 110', () => {
    expect(sass).toMatch(
      /\.chrome-search--docked[\s\S]*?pointer-events:\s*none/
    );
    expect(sass).toMatch(
      /\.chrome-search--docked[\s\S]*?#searchboxwrapper[\s\S]*?pointer-events:\s*auto/
    );
    expect(sass).toMatch(
      /\.chrome-search--docked[\s\S]*?#searchbar[\s\S]*?pointer-events:\s*none/
    );
  });

  it('CHROME-DOCK-002: CSS fallback leaves right inset for toolbar actions instead of full-bleed width', () => {
    expect(sass).toMatch(/\.chrome-search--docked[\s\S]*?right:\s*7rem/);
    expect(sass).not.toMatch(
      /\.chrome-search--docked[\s\S]*?width:\s*calc\(100vw - 11rem\)/
    );
  });

  it('CHROME-DOCK-003: toolbar hydrates (no ngSkipHydration) so Add/Profile click handlers bind on cold load', () => {
    expect(toolbarTs).not.toMatch(/ngSkipHydration:\s*['"]true['"]/);
    expect(toolbarTs).not.toMatch(/host:\s*\{\s*ngSkipHydration/);
    expect(toolbarTs).toMatch(/afterNextRender/);
    expect(toolbarTs).toMatch(/authChromeReady/);
  });
});
