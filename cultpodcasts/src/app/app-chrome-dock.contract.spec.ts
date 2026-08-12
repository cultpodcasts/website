import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('site chrome docked search (privacy-policy cold load)', () => {
  const sass = readFileSync(
    join(__dirname, 'app.component.sass'),
    'utf8'
  );
  const appHtml = readFileSync(
    join(__dirname, 'app.component.html'),
    'utf8'
  );
  const appTs = readFileSync(
    join(__dirname, 'app.component.ts'),
    'utf8'
  );
  const toolbarTs = readFileSync(
    join(__dirname, 'toolbar/toolbar.component.ts'),
    'utf8'
  );
  const searchBarTs = readFileSync(
    join(__dirname, 'search-bar/search-bar.component.ts'),
    'utf8'
  );
  const contentTs = readFileSync(
    join(__dirname, 'content/content.component.ts'),
    'utf8'
  );
  const contentHtml = readFileSync(
    join(__dirname, 'content/content.component.html'),
    'utf8'
  );
  const routesTs = readFileSync(
    join(__dirname, 'app.routes.ts'),
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

  it('CHROME-DOCK-004: search-bar hydrates (no ngSkipHydration) so typeahead listeners bind on cold load', () => {
    expect(searchBarTs).not.toMatch(/ngSkipHydration:\s*['"]true['"]/);
    expect(searchBarTs).not.toMatch(/host:\s*\{\s*ngSkipHydration/);
    expect(searchBarTs).toMatch(/applyChipFromUrl/);
  });

  it('CHROME-DOCK-005: content pages use child routes (no @switch on :path)', () => {
    expect(contentHtml).toMatch(/router-outlet/);
    expect(contentHtml).not.toMatch(/@switch/);
    expect(contentTs).not.toMatch(/ngSkipHydration/);
    expect(routesTs).toMatch(/path:\s*['"]privacy-policy['"]/);
    expect(routesTs).toMatch(/PrivacyPolicyComponent/);
  });

  it('CHROME-DOCK-006: drop overlay host stays mounted; idle body is structural @if inside', () => {
    expect(appHtml).toMatch(/drop-overlay--active/);
    expect(appHtml).toMatch(/@if\s*\(\s*isDragOver\(\)\s*\)/);
    expect(sass).toMatch(/\.drop-overlay--active/);
  });

  it('CHROME-DOCK-008: no prerendered /content/*; server SSRs content from index.csr.html', () => {
    const serverTs = readFileSync(join(__dirname, '../../server.ts'), 'utf8');
    const prerenderRoutes = readFileSync(join(__dirname, '../../prerender-routes'), 'utf8');
    expect(prerenderRoutes).not.toMatch(/\/content\//);
    // Must not CSR-shell legal pages — request-time SSR so view-source has body text.
    expect(serverTs).not.toMatch(/pathname\.startsWith\(['"]\/content\//);
    expect(serverTs).toMatch(/isAuthClientOnlyPath/);
    expect(serverTs).toMatch(/renderApplication/);
    // Empty CSR shell only — never bootstrap from prerendered `/` (duplicate ng-state / NG0500).
    expect(serverTs).toMatch(/index\.csr\.html/);
    expect(serverTs).toMatch(/new URL\(\s*['"]\/index\.csr\.html['"]/);
  });

  it('CHROME-DOCK-007: chromeStuck is computed from isHomePage so browse SSR emits chrome-stuck', () => {
    expect(appTs).toMatch(/homeScrollDocked/);
    expect(appTs).toMatch(/chromeStuck\s*=\s*computed/);
    expect(appTs).not.toMatch(/chromeStuck\s*=\s*signal\(/);
  });
});
