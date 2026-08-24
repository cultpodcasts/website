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

  it('CHROME-DOCK-009: drop-targets and drop-overlay-message differentiate between podcast page and non-podcast page using structural control flow', () => {
    expect(appHtml).toMatch(/@if\s*\(\s*isOnPodcastPage\(\)\s*&&\s*canSubmitUrlForPodcast\(\)\s*\)/);
    expect(appHtml).not.toMatch(/class="drop-targets"\s+\[hidden\]/);
    expect(appHtml).not.toMatch(/class="drop-overlay-message"\s+\[hidden\]/);
  });

  it('CHROME-DOCK-008: privacy/terms are prerendered SSG and excluded from the Pages Worker', () => {
    const serverTs = readFileSync(join(__dirname, '../../server.ts'), 'utf8');
    const mainServer = readFileSync(join(__dirname, '../../src/main.server.ts'), 'utf8');
    const prerenderRoutes = readFileSync(join(__dirname, '../../prerender-routes'), 'utf8');
    const routesJson = readFileSync(join(__dirname, '../_routes.json'), 'utf8');
    expect(prerenderRoutes).toMatch(/\/content\/privacy-policy/);
    expect(prerenderRoutes).toMatch(/\/content\/terms-and-conditions/);
    // Static asset serve — Worker must not re-SSR (would fight the SSG tree).
    expect(routesJson).toMatch(/\/content\/privacy-policy/);
    expect(routesJson).toMatch(/\/content\/terms-and-conditions/);
    expect(routesJson).toMatch(/"exclude"/);
    // Must not CSR-shell legal pages (body must be in the baked HTML).
    expect(serverTs).not.toMatch(/pathname\.startsWith\(['"]\/content\//);
    expect(serverTs).toMatch(/isAuthClientOnlyPath/);
    expect(serverTs).toMatch(/renderApplication/);
    // Other SSR routes still bootstrap from empty CSR shell (never homepage index.html).
    expect(serverTs).toMatch(/index\.csr\.html/);
    expect(serverTs).toMatch(/new URL\(\s*['"]\/index\.csr\.html['"]/);
    // Local HTTPS uses .cert — no NODE_TLS_REJECT_UNAUTHORIZED / ssrIgnoresSsl.
    expect(mainServer).not.toMatch(/NODE_TLS_REJECT_UNAUTHORIZED/);
    expect(mainServer).not.toMatch(/ssrIgnoresSsl/);
  });

  it('CHROME-DOCK-007: chromeStuck is computed from isHomePage so browse SSR emits chrome-stuck', () => {
    expect(appTs).toMatch(/homeScrollDocked/);
    expect(appTs).toMatch(/chromeStuck\s*=\s*computed/);
    expect(appTs).not.toMatch(/chromeStuck\s*=\s*signal\(/);
  });

  it('CHROME-DOCK-010: home search slot reserves --site-chrome-h so dock cannot collapse flow', () => {
    expect(appHtml).toMatch(/chrome-search-slot/);
    expect(sass).toMatch(
      /\.home-shell\s+\.chrome-search-slot[\s\S]*?min-height:\s*var\(--site-chrome-h\)/
    );
    expect(sass).not.toMatch(
      /\.home-shell\.chrome-stuck\s+\.site-chrome__bar-spacer[\s\S]*?height:\s*var\(--site-chrome-bar-h\)/
    );
  });

  it('CHROME-DOCK-011: dropped home search spans the chrome gap (not a 640px centered pill)', () => {
    expect(sass).toMatch(/\.chrome-search[\s\S]*?margin:\s*var\(--site-chrome-search-gap\)\s+7rem\s+12px\s+70px/);
    expect(sass).not.toMatch(/width:\s*min\(640px,\s*calc\(100%\s*-\s*2\.5rem\)\)/);
    expect(appTs).toMatch(/layoutDroppedSearch/);
    expect(appTs).toMatch(/HOME_UNDOCK_SCROLL_PX/);
    expect(appTs).not.toMatch(/MIN_SCROLL_TO_DOCK_PX/);
  });
});
