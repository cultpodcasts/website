/**
 * Builds docs/hero-legibility.html from the live hero stylesheet.
 *
 * The harness must never carry a hand-copied snapshot of the CSS it claims to
 * verify, so the component sass is compiled in and stamped with its hash.
 *
 *   node ./tools/build-hero-legibility-harness.mjs          # write
 *   node ./tools/build-hero-legibility-harness.mjs --check   # fail if stale
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, '..');

const SASS_PATH = join(appRoot, 'src/app/homepage-hero/homepage-hero.component.sass');
const TEMPLATE_PATH = join(here, 'hero-legibility-harness.template.html');
const OUT_PATH = join(appRoot, 'docs/hero-legibility.html');
const COMMAND = 'npm run hero:legibility';

let sass;
try {
  sass = require('sass');
} catch {
  console.error('Could not resolve "sass". Run npm install first.');
  process.exit(1);
}

const sourceCss = readFileSync(SASS_PATH);
const sha256 = createHash('sha256').update(sourceCss).digest('hex');

const compiled = sass.compile(SASS_PATH, { style: 'expanded', sourceMap: false });

/**
 * :host / :host-context only resolve inside a shadow tree. The harness renders
 * the component markup in a plain document, so map them onto a wrapper class.
 */
const css = compiled.css
  .replace(/:host-context\(([^)]*)\)\s*/g, '$1 ')
  .replace(/:host/g, '.hero-host');

const meta = {
  source: relative(appRoot, SASS_PATH).replace(/\\/g, '/'),
  sha256,
  command: COMMAND
};

const template = readFileSync(TEMPLATE_PATH, 'utf8');
for (const token of ['/*__HERO_CSS__*/', '/*__HERO_META__*/']) {
  if (!template.includes(token)) {
    console.error(`Template is missing the ${token} placeholder.`);
    process.exit(1);
  }
}

const output = template
  .replace('/*__HERO_CSS__*/', () => css)
  .replace('/*__HERO_META__*/', () => JSON.stringify(meta, null, 2));

if (process.argv.includes('--check')) {
  let existing = null;
  try {
    existing = readFileSync(OUT_PATH, 'utf8');
  } catch {
    console.error(`${relative(appRoot, OUT_PATH)} is missing. Run ${COMMAND}.`);
    process.exit(1);
  }
  if (existing !== output) {
    console.error(`${relative(appRoot, OUT_PATH)} is stale. Run ${COMMAND}.`);
    process.exit(1);
  }
  console.log(`hero-legibility.html is up to date (sass sha256 ${sha256.slice(0, 16)}…).`);
  process.exit(0);
}

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, output);
console.log(`Wrote ${relative(appRoot, OUT_PATH)} (sass sha256 ${sha256.slice(0, 16)}…, ${css.length} bytes of CSS).`);
