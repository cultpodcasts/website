import * as sass from "sass";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HeroLayoutCase, renderBillboardHtml } from "./fixtures";

const heroSassPath = join(
  process.cwd(),
  "src",
  "app",
  "homepage-hero",
  "homepage-hero.component.sass"
);
const stylesPath = join(process.cwd(), "src", "styles.scss");

/** Compile real hero component Sass for light-DOM harness (rewrite :host). */
export function compileHeroLayoutCss(): string {
  const heroCss = sass.compile(heroSassPath, { style: "expanded" }).css
    .replaceAll(":host-context(.cdk-global-scrollblock)", ".cdk-global-scrollblock .hero-layout-host")
    .replaceAll(":host", ".hero-layout-host");

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

  return `${tokenCss}\n${stylesSnippet}\n${heroCss}`;
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
</body>
</html>`;
}
