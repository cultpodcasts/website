import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AppComponent } from './app.component';
import { routes } from './app.routes';
import { isAuthClientOnlyPath } from './auth-client-only-path';
import { ContentComponent } from './content/content.component';
import { PrivacyPolicyComponent } from './privacy-policy/privacy-policy.component';
import { SearchBarComponent } from './search-bar/search-bar.component';
import { ToolbarComponent } from './toolbar/toolbar.component';

function compiledHost(cmp: unknown): string {
  return JSON.stringify((cmp as { ɵcmp?: unknown }).ɵcmp ?? {});
}

function contentChildren(): { path?: string; component?: unknown }[] {
  const content = routes.find((r) => r.path === 'content');
  return (content?.children ?? []) as { path?: string; component?: unknown }[];
}

describe('site chrome docked search (privacy-policy cold load)', () => {
  const sass = readFileSync(join(__dirname, 'app.component.sass'), 'utf8');
  const appHtml = readFileSync(join(__dirname, 'app.component.html'), 'utf8');
  const contentHtml = readFileSync(
    join(__dirname, 'content/content.component.html'),
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
    expect(compiledHost(ToolbarComponent)).not.toMatch(/ngSkipHydration/);
    expect(
      typeof (ToolbarComponent.prototype as unknown as { showSignedInChrome?: unknown }).showSignedInChrome
    ).toBe('function');
  });

  it('CHROME-DOCK-004: search-bar hydrates (no ngSkipHydration) so typeahead listeners bind on cold load', () => {
    expect(compiledHost(SearchBarComponent)).not.toMatch(/ngSkipHydration/);
    expect(
      typeof (SearchBarComponent.prototype as unknown as { applyChipFromUrl?: unknown }).applyChipFromUrl
    ).toBe('function');
  });

  it('CHROME-DOCK-005: content pages use child routes (no @switch on :path)', () => {
    expect(contentHtml).toMatch(/router-outlet/);
    expect(contentHtml).not.toMatch(/@switch/);
    expect(compiledHost(ContentComponent)).not.toMatch(/ngSkipHydration/);
    const privacy = contentChildren().find((c) => c.path === 'privacy-policy');
    expect(privacy?.component).toBe(PrivacyPolicyComponent);
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

  it('CHROME-DOCK-DROP: podcast-page overlay keeps two targets and does not add a third zone', () => {
    const targets = appHtml.match(/class="drop-target"/g);
    expect(targets?.length).toBe(2);
    expect(appHtml).toMatch(/Add as a general submission/);
    expect(appHtml).toMatch(/Link this episode to the podcast shown on this page/);
    expect(appHtml).not.toMatch(/drop-target-warn/);
  });

  it('CHROME-DOCK-008: privacy/terms are prerendered SSG and excluded from the Pages Worker', () => {
    const prerenderRoutes = readFileSync(join(__dirname, '../../prerender-routes'), 'utf8');
    const routesJson = readFileSync(join(__dirname, '../_routes.json'), 'utf8');
    expect(prerenderRoutes).toMatch(/\/content\/privacy-policy/);
    expect(prerenderRoutes).toMatch(/\/content\/terms-and-conditions/);
    expect(routesJson).toMatch(/\/content\/privacy-policy/);
    expect(routesJson).toMatch(/\/content\/terms-and-conditions/);
    expect(routesJson).toMatch(/"exclude"/);
    expect(isAuthClientOnlyPath('/content/privacy-policy')).toBe(false);
    expect(isAuthClientOnlyPath('/content/terms-and-conditions')).toBe(false);
    expect(isAuthClientOnlyPath('/discovery')).toBe(true);
  });

  it('CHROME-DOCK-007: chrome-stuck is driven from the template binding', () => {
    expect(appHtml).toMatch(/chromeStuck/);
    expect(appHtml).toMatch(/\[class\.chrome-stuck\]/);
  });

  it('CHROME-DOCK-010: home search slot reserves --site-chrome-h so dock cannot collapse flow', () => {
    expect(appHtml).toMatch(/chrome-search-slot/);
    expect(sass).toMatch(
      /\.home-shell\s+\.chrome-search-slot[\s\S]*?min-height:\s*var\(--site-chrome-h\)/
    );
    expect(sass).toMatch(
      /\.home-shell\s+\.chrome-search-slot[\s\S]*?display:\s*flow-root/
    );
    const slotRule =
      sass.match(/^\.chrome-search-slot\r?\n(?:[ \t].*\r?\n|\r?\n)*/m)?.[0] ?? '';
    expect(slotRule).toMatch(/pointer-events:\s*none/);
    expect(slotRule).not.toMatch(/^[ \t]+z-index:/m);
    expect(sass).not.toMatch(
      /\.home-shell\.chrome-stuck\s+\.site-chrome__bar-spacer[\s\S]*?height:\s*var\(--site-chrome-bar-h\)/
    );
    expect(sass).toMatch(
      /@media screen and \(max-width:\s*700px\)[\s\S]*?\.home-shell\s+\.chrome-search-slot[\s\S]*?min-height:\s*0/
    );
  });

  it('CHROME-DOCK-011: dropped overlay is a centered 640px field; wide routes pin via sticky/fixed not a layout swap', () => {
    expect(sass).toMatch(/width:\s*min\(640px,\s*calc\(100%\s*-\s*2\.5rem\)\)/);
    expect(sass).toMatch(/margin:\s*var\(--site-chrome-search-gap\)\s+auto\s+12px/);
    expect(sass).toMatch(/\.home-shell\s+\.chrome-search[\s\S]*?position:\s*sticky/);
    expect(sass).toMatch(
      /\.chrome-stuck\s+\.chrome-search[\s\S]*?position:\s*fixed/
    );
    expect(sass).toMatch(/\.chrome-stuck\s+\.chrome-search\.chrome-search--docked/);
    expect(appHtml).toMatch(/fillHeaderSearchGap/);
    const proto = AppComponent.prototype as unknown as Record<string, unknown>;
    expect(typeof proto['layoutDroppedSearch']).toBe('function');
    expect(typeof proto['homeStickTop']).toBe('function');
    expect(typeof proto['homePinAtScrollY']).toBe('function');
    expect(typeof proto['clearDockedSearchLayout']).toBe('function');
    expect(proto['layoutHomeDockedSearch']).toBeUndefined();
  });
});
