import * as sass from "sass";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HeroLayoutCase, renderBillboardHtml, renderStatsStripHtml } from "./fixtures";
import { expandedDescLayout, HERO_DESC_GROW, measureCollapsedDesc } from "../../src/app/homepage-hero/hero-desc-layout";

const heroSassPath = join(
  process.cwd(),
  "src",
  "app",
  "homepage-hero",
  "homepage-hero.component.sass"
);
const queueButtonSassPath = join(process.cwd(), "src", "app", "queue-button", "queue-button.component.sass");
const stylesPath = join(process.cwd(), "src", "styles.scss");
const catalogueSassPath = join(
  process.cwd(),
  "src",
  "app",
  "homepage-catalogue",
  "homepage-catalogue.component.sass"
);

/** Compile real hero component Sass for light-DOM harness (rewrite :host). */
export function compileHeroLayoutCss(): string {
  const heroCss = sass.compile(heroSassPath, { style: "expanded" }).css
    .replaceAll(":host-context(.cdk-global-scrollblock)", ".cdk-global-scrollblock .hero-layout-host")
    .replaceAll(":host", ".hero-layout-host");
  // The shared Add to Queue button (HERO-QUE-001), scoped to its host tag.
  const queueButtonCss = sass.compile(queueButtonSassPath, { style: "expanded" }).css
    .replace(/:host\(([^)]*)\)/g, "app-queue-button$1")
    .replaceAll(":host", "app-queue-button");
  // The stats strip under the hero (mock markup, real Sass): its -28px overlap and z-index are
  // what an expanded hero must not paint over (HERO-DSC-004).
  const catalogueCss = sass.compile(catalogueSassPath, { style: "expanded" }).css
    .replace(/:host\(([^)]*)\)/g, "app-homepage-catalogue$1")
    .replaceAll(":host", "app-homepage-catalogue");

  const tokenCss = `
.hero-layout-root {
  --cp-font-display: Georgia, 'Times New Roman', serif;
  --cp-font-ui: system-ui, sans-serif;
  --nflx-accent: #e8a23a;
  --nflx-on-media: #fff;
  --nflx-on-media-muted: #e8e8e8;
  --site-chrome-bar-h: 52px;
  --nflx-hero-search-clearance: 140px;
  margin: 0;
  background: #0b0b0b;
  color: #fff;
  font-family: var(--cp-font-ui);
}
.hero-layout-chip {
  display: inline-block;
  padding: 4px 10px;
  border: 1px solid #ffffff55;
  border-radius: 999px;
  font-size: 0.85rem;
}
.hero-pill {
  display: inline-block;
  padding: 4px 12px;
  border: 1px solid #ffffff55;
  border-radius: 999px;
  font-size: 0.85rem;
}
.hero-meta { margin: 0; }
/* mat-icon-button look for the expander (round, centred icon). */
.billboard__desc-toggle {
  display: grid;
  place-items: center;
  border-radius: 50%;
  cursor: pointer;
}
.billboard__desc-toggle .mat-icon { display: block; line-height: 20px; text-align: center; }
.billboard__desc-wrap.is-expanded .billboard__desc-toggle .mat-icon { transform: rotate(180deg); }
.hero-layout-rails { padding: 24px 4vw 120px; }
.hero-layout-rail {
  height: 220px;
  margin-bottom: 24px;
  border-radius: 12px;
  background: #1a1a1a;
  color: #777;
  padding: 12px;
}
.catalogue__label { margin: 0; color: #bbb; }
.hero-show { margin: 0 0 8px; }
`;

  let stylesSnippet = "";
  try {
    const styles = readFileSync(stylesPath, "utf8");
    if (styles.includes(".hero-meta")) {
      stylesSnippet = "/* styles.scss present — tokens inlined above */";
    }
  } catch {
    /* optional */
  }

  return `${tokenCss}\n${stylesSnippet}\n${heroCss}\n${queueButtonCss}\n${catalogueCss}`;
}

export function buildHeroLayoutDocument(c: HeroLayoutCase): string {
  const css = compileHeroLayoutCss();
  const billboard = renderBillboardHtml(c);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Hero layout harness — ${c.id}</title>
  <style>${css}</style>
</head>
<body class="hero-layout-root">
  <div class="hero-layout-host">${billboard}</div>
  ${renderStatsStripHtml()}
  <script>${expandScript()}</script>
</body>
</html>`;
}

/**
 * In-page expander that mirrors HomepageHeroComponent.toggleDesc (HERO-DSC-002..004): measure the
 * collapsed card, then lock the hero height, set the expanded classes, size the description and
 * shift a bottom-anchored card with the component's own `measureCollapsedDesc` and
 * `expandedDescLayout` (serialised here, so harness and component measure and size identically).
 * Collapse restores the exact collapsed layout.
 * Exposed as `window.heroLayoutHarness.toggleDesc()`; the chevron click calls it too.
 */
function expandScript(): string {
  return `
(() => {
  const measureCollapsedDesc = ${measureCollapsedDesc.toString()};
  const expandedDescLayout = ${expandedDescLayout.toString()};
  const GROW = ${JSON.stringify(HERO_DESC_GROW)};
  const q = (sel) => document.querySelector(sel);
  let metrics = null;
  function expand() {
    const hero = q(".billboard"), card = q(".billboard__content");
    const wrap = q(".billboard__desc-wrap"), desc = q(".billboard__desc");
    const toggle = q(".billboard__desc-toggle");
    if (!hero || !card || !wrap || !desc || !toggle) return;
    metrics = measureCollapsedDesc(hero, card, desc);
    hero.classList.add("is-desc-expanded");
    wrap.classList.add("is-expanded");
    desc.classList.add("is-expanded");
    desc.tabIndex = 0;
    q(".billboard__desc-fade")?.remove();
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const layout = expandedDescLayout(metrics, vh, GROW);
    hero.style.height = layout.heroH + "px";
    desc.style.height = layout.descPx + "px";
    card.style.transform = layout.shiftPx ? "translateY(" + layout.shiftPx + "px)" : "";
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Collapse description");
  }
  function collapse() {
    const hero = q(".billboard"), card = q(".billboard__content");
    const wrap = q(".billboard__desc-wrap"), desc = q(".billboard__desc");
    const toggle = q(".billboard__desc-toggle");
    metrics = null;
    hero.classList.remove("is-desc-expanded");
    wrap.classList.remove("is-expanded");
    desc.classList.remove("is-expanded");
    desc.removeAttribute("tabindex");
    hero.style.height = "";
    desc.style.height = "";
    card.style.transform = "";
    desc.scrollTop = 0;
    if (!q(".billboard__desc-fade")) {
      const fade = document.createElement("span");
      fade.className = "billboard__desc-fade";
      fade.setAttribute("aria-hidden", "true");
      wrap.insertBefore(fade, toggle);
    }
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Expand description");
  }
  function toggleDesc() {
    if (metrics) collapse(); else expand();
  }
  window.heroLayoutHarness = { toggleDesc, isExpanded: () => metrics !== null };
  document.addEventListener("click", (e) => {
    if (e.target instanceof Element && e.target.closest(".billboard__desc-toggle")) toggleDesc();
  });
})();`;
}
