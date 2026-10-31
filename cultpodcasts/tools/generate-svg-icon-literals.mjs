import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.resolve(root, '../src/assets');
const outFile = path.resolve(root, '../src/app/svg-icon-literals.ts');
const simpleIconPaths = JSON.parse(
  fs.readFileSync(path.join(root, 'icon-sources/paths.json'), 'utf8'),
);

/** Asset-backed icons under src/assets/. */
const assetIcons = [
  ['cultpodcasts', 'cultpodcasts.svg'],
  ['add-podcast', 'add-podcast.svg'],
  ['reddit', 'reddit.svg'],
  ['twitter', 'twitter.svg'],
  ['github', 'github.svg'],
  ['spotify', 'spotify.svg'],
  ['youtube', 'youtube.svg'],
  ['bbc-iplayer', 'BBC_iPlayer_2021_(symbol).svg'],
  ['bbc-sounds', 'bbc_sounds.svg'],
  ['internet-archive', 'Internet_Archive_logo_and_wordmark.svg'],
  ['profile', 'profile.svg'],
  ['bluesky', 'bluesky.svg'],
  ['android', 'android.svg'],
  ['visible', 'visible.svg'],
  ['removed', 'removed.svg'],
];

/**
 * 24×24 rounded-rect box matching Spotify/YouTube episode-link icon size.
 * Simple Icons paths are inset so the mark sits inside the shared corner radius.
 */
function boxedIcon(bg, pathD, { fg = '#fff', inset = 2.75 } = {}) {
  const scale = (24 - inset * 2) / 24;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="5.4" fill="${bg}"/>` +
    `<g transform="translate(${inset} ${inset}) scale(${scale})">` +
    `<path fill="${fg}" d="${pathD}"/>` +
    `</g></svg>`
  );
}

function readSvgInner(file) {
  // Normalise CRLF/CR to LF so a Windows (autocrlf) checkout generates the same literals as Linux.
  const raw = fs.readFileSync(path.join(root, 'icon-sources', file), 'utf8').replace(/\r\n?/g, '\n');
  const vbMatch = raw.match(/viewBox=["']([^"']+)["']/i);
  const viewBox = vbMatch ? vbMatch[1] : '0 0 24 24';
  const inner = raw
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<svg\b[^>]*>/i, '')
    .replace(/<\/svg>\s*$/i, '')
    .trim();
  return { viewBox, inner };
}

/** Official storefront SVG clipped to the shared 24×24 rounded tile. */
function boxedOfficialSvg(file, clipId) {
  const { viewBox, inner } = readSvgInner(file);
  const alreadyTile = viewBox.trim() === '0 0 24 24';
  const content = alreadyTile
    ? inner
    : `<svg width="24" height="24" viewBox="${viewBox}" preserveAspectRatio="xMidYMid slice">${inner}</svg>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<defs><clipPath id="${clipId}"><rect width="24" height="24" rx="5.4"/></clipPath></defs>` +
    `<g clip-path="url(#${clipId})">${content}</g></svg>`
  );
}

/** Official storefront PNG (96×96) clipped to the shared 24×24 rounded tile. */
function boxedOfficialPng(file, clipId) {
  const png = fs.readFileSync(path.join(root, 'icon-sources', file));
  const b64 = png.toString('base64');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<defs><clipPath id="${clipId}"><rect width="24" height="24" rx="5.4"/></clipPath></defs>` +
    `<image href="data:image/png;base64,${b64}" width="24" height="24" ` +
    `clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice"/>` +
    `</svg>`
  );
}

/** Rounds every number in an SVG path `d` to 2dp (keeps the literal compact; geometry unchanged at 24 px). */
function roundPathData(d) {
  return d.replace(/-?\d*\.?\d+(?:e-?\d+)?/gi, (n) => String(Number(Number(n).toFixed(2))));
}

/** Path `d` strings of an icon-sources SVG, in document order. */
function readSvgPathData(file) {
  const { inner } = readSvgInner(file);
  return [...inner.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map((m) => m[1]);
}

/** iview teal sampled from the live apple-touch icon (/images/touchicon.png). */
const ABC_IVIEW_TEAL = '#2FB7B6';

/**
 * Where each part of the ABC iview masthead SVG (viewBox 0 0 100 32) lands on the 24×24 tile.
 * Both parts share one horizontal band, 14.4 wide (60% of the tile) from x 4.8 to 19.2, so the
 * mark is centred like the live app icon. For each part:
 *   scale      = 14.4 / source width
 *   translateX = 4.8 - sourceLeft × scale
 *   translateY = targetTop - sourceTop × scale
 * Values are rounded (scale 4dp, translate 2dp).
 *
 * - lissajous: source paths 7–8 (the ABC symbol), bbox x 0.59–23.72, y 10.59–27.96.
 *   Target top y 3.6, so it ends at y 14.4, the upper ~60% of the tile.
 * - wordmark: source paths 0–6 (`iview`, including the i dot and the play triangle in the e),
 *   bbox x 27.8–99.41, y 4–28. Target top y 15.4 (1 below the lissajous), baseline at y 20.23.
 */
const ABC_IVIEW_LAYOUT = {
  lissajous: { paths: [7, 8], scale: 0.6226, translateX: 4.43, translateY: -3 },
  wordmark: { paths: [0, 1, 2, 3, 4, 5, 6], scale: 0.2011, translateX: -0.79, translateY: 14.6 },
};

function abcIviewIcon() {
  const sourcePaths = readSvgPathData('abc-iview-logo.svg');
  const part = ({ paths, scale, translateX, translateY }) => {
    const d = roundPathData(paths.map((i) => sourcePaths[i]).join(''));
    const transform = `matrix(${scale} 0 0 ${scale} ${translateX} ${translateY})`;
    return `<path fill="#fff" transform="${transform}" d="${d}"/>`;
  };
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="5.4" fill="${ABC_IVIEW_TEAL}"/>` +
    part(ABC_IVIEW_LAYOUT.lissajous) +
    part(ABC_IVIEW_LAYOUT.wordmark) +
    `</svg>`
  );
}

/** CBC Gem red sampled from the live app icon (gem.cbc.ca/android-chrome-512x512.png). */
const CBC_GEM_RED = '#E60505';

/**
 * Where the CBC gem (path 0 of the gem.cbc.ca header logo, viewBox 0 0 292 72) lands on the
 * 24×24 tile. Its bbox is x 0.03–71.81, y 0.03–71.81 (centre 35.92, 35.92). The live app icon
 * draws the gem 301/512 = 58.8% of the tile wide, centred, so here it is 14.1 wide around (12, 12):
 *   scale     = 14.1 / 71.78
 *   translate = 12 - 35.92 × scale (same for x and y)
 * Values are rounded (scale 4dp, translate 2dp). Path 1 is the white "Gem" wordmark, not used.
 */
const CBC_GEM_LAYOUT = { path: 0, scale: 0.1964, translate: 4.95 };

function cbcGemIcon() {
  const { path, scale, translate } = CBC_GEM_LAYOUT;
  // Not roundPathData: the source packs arc flags (`0 0012.8`), which number rounding would merge.
  const d = readSvgPathData('cbc-gem-logo.svg')[path];
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="5.4" fill="${CBC_GEM_RED}"/>` +
    `<path fill="#fff" transform="matrix(${scale} 0 0 ${scale} ${translate} ${translate})" d="${d}"/>` +
    `</svg>`
  );
}

/**
 * Compact streaming / service mark SVGs (no separate asset files).
 * Prefer official storefront SVG. Raster app icons are PNG only when the
 * live mark is photographic / 3D and has no usable colourful SVG.
 * Edit here (or refresh icon-sources), then regenerate — do not hand-edit
 * svg-icon-literals.ts.
 */
const streamingIconSvgs = {
  // Vimeo — official iris mark on the live apple-touch charcoal tile.
  vimeo: boxedOfficialSvg('vimeo-iris.svg', 'cp-vimeo-clip'),
  // Netflix N on near-black (SI path is the N glyph).
  netflix: boxedIcon('#141414', simpleIconPaths.netflix, { fg: '#E50914', inset: 1.5 }),
  // Prime Video — live app icon: bright blue + stacked wordmark + yellow smile.
  'amazon-prime':
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="5.4" fill="#0578FF"/>` +
    `<text x="12" y="9.4" text-anchor="middle" fill="#fff" font-family="Arial, Helvetica, sans-serif" font-size="5.4" font-weight="700" letter-spacing="0.15">prime</text>` +
    `<text x="12" y="14.6" text-anchor="middle" fill="#fff" font-family="Arial, Helvetica, sans-serif" font-size="5.4" font-weight="700" letter-spacing="0.1">video</text>` +
    `<path fill="none" stroke="#FF9900" stroke-width="1.55" stroke-linecap="round" d="M5.2 16.4c2.5 2 5.2 3 8.4 3 1.7 0 3.3-.3 4.8-.9"/>` +
    `<path fill="#FF9900" d="M17.2 16.7l3 .8-2.2 2.2z"/>` +
    `</svg>`,
  'paramount-plus': boxedIcon('#0064FF', simpleIconPaths.paramountplus, { inset: 1.25 }),
  // Max — official 1-color stacked logo SVG from brand.hbomax.com.
  // Do NOT use SI "max" (self-boxed black glyph — invisible on dark chrome).
  'hbo-max': boxedOfficialSvg('hbo-max-logo.svg', 'cp-hbo-max-clip'),
  // Play Suisse — official chevron + plus paths on the live red tile.
  'play-suisse': boxedOfficialSvg('play-suisse-icon.svg', 'cp-play-suisse-clip'),
  // Play RTS — live apple-touch: SRG red tile with RTS wordmark.
  'play-rts':
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="5.4" fill="#AF001E"/>` +
    `<text x="12" y="15.4" text-anchor="middle" fill="#fff" font-family="Arial Black, Impact, Arial, sans-serif" font-size="8" font-weight="900" letter-spacing="0.4">RTS</text>` +
    `</svg>`,
  // TVNZ+ — live favicon: cyan/blue plus on black (not a "tvnz" wordmark).
  'tvnz-plus':
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<defs><linearGradient id="cp-tvnz-plus-grad" x1="0%" y1="100%" x2="100%" y2="0%">` +
    `<stop offset="0%" stop-color="#0057FF"/><stop offset="100%" stop-color="#00E5FF"/>` +
    `</linearGradient></defs>` +
    `<rect width="24" height="24" rx="5.4" fill="#000"/>` +
    `<path fill="url(#cp-tvnz-plus-grad)" d="M9.45 1.65h5.1v7.7h7.8v5.1h-7.8v7.7h-5.1v-7.7H1.65v-5.1h7.8z"/>` +
    `</svg>`,
  // ITVX — live App Store / apple-touch PNG (lime tile, navy X).
  itvx: boxedOfficialPng('itvx-app-icon.png', 'cp-itvx-clip'),
  // Channel 4 — official storefront favicon.svg (lime tile, black 4).
  channel4: boxedOfficialSvg('channel4-favicon.svg', 'cp-channel4-clip'),
  // Fawesome — live apple-touch: navy tile, three white triangles (not a generic F).
  fawesome:
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="5.4" fill="#0E0E21"/>` +
    `<path fill="#fff" d="M5.15 3.45h5.35L8.05 13.7z"/>` +
    `<path fill="#fff" d="M13.5 3.45h5.35L16.2 13.7z"/>` +
    `<path fill="#fff" d="M12 13.05l2.7 7.35H9.3z"/>` +
    `</svg>`,
  // Disney+ — live bamgrid app icon (aurora raster; mask-icon SVG is monochrome).
  'disney-plus': boxedOfficialPng('disney-plus-app-icon.png', 'cp-disney-plus-clip'),
  // Video-host tile — official storefront favicon PNG (red C).
  bitchute: boxedOfficialPng('bc-app-icon.png', 'cp-bc-clip'),
  // Tubi — live apple-touch app icon.
  tubi: boxedOfficialPng('tubi-app-icon.png', 'cp-tubi-clip'),
  // D+ — official apple-touch app icon (3D raster; no colourful SVG).
  'discovery-plus': boxedOfficialPng('dplus-app-icon.png', 'cp-dplus-clip'),
  // France TV — brand blue tile with FTV wordmark.
  'france-tv':
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="5.4" fill="#0C1B8C"/>` +
    `<text x="12" y="15.2" text-anchor="middle" fill="#fff" font-family="Arial Black, Impact, Arial, sans-serif" font-size="7.2" font-weight="900" letter-spacing="0.35">FTV</text>` +
    `</svg>`,
  // ARTE — orange tile with the ARTE wordmark (catalogue is multi-language, not French-only).
  arte:
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="5.4" fill="#FF4D00"/>` +
    `<text x="12" y="15.4" text-anchor="middle" fill="#fff" font-family="Arial Black, Impact, Arial, sans-serif" font-size="5.6" font-weight="900" letter-spacing="0.2">ARTE</text>` +
    `</svg>`,
  // Hulu — green tile with Hulu wordmark.
  hulu:
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="5.4" fill="#1CE783"/>` +
    `<text x="12" y="15.4" text-anchor="middle" fill="#0B0B0B" font-family="Arial Black, Impact, Arial, sans-serif" font-size="6.2" font-weight="900" letter-spacing="0.1">hulu</text>` +
    `</svg>`,
  // Peacock — yellow tile with peacock wordmark.
  peacock:
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="5.4" fill="#FFC800"/>` +
    `<text x="12" y="15.2" text-anchor="middle" fill="#111" font-family="Arial Black, Impact, Arial, sans-serif" font-size="4.4" font-weight="900" letter-spacing="-0.2">PEACOCK</text>` +
    `</svg>`,
  // Apple TV+ — black tile with TV+ wordmark.
  'apple-tv-plus':
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="5.4" fill="#000"/>` +
    `<text x="12" y="15.4" text-anchor="middle" fill="#fff" font-family="Arial Black, Impact, Arial, sans-serif" font-size="6" font-weight="900" letter-spacing="0.1">TV+</text>` +
    `</svg>`,
  // ZDF — orange tile with ZDF wordmark.
  zdf:
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="5.4" fill="#FA7D19"/>` +
    `<text x="12" y="15.4" text-anchor="middle" fill="#fff" font-family="Arial Black, Impact, Arial, sans-serif" font-size="7" font-weight="900" letter-spacing="0.3">ZDF</text>` +
    `</svg>`,
  // ARD — blue tile with ARD wordmark.
  ard:
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="5.4" fill="#003D7A"/>` +
    `<text x="12" y="15.4" text-anchor="middle" fill="#fff" font-family="Arial Black, Impact, Arial, sans-serif" font-size="7" font-weight="900" letter-spacing="0.3">ARD</text>` +
    `</svg>`,
  // Canal+ — black tile with C+ wordmark.
  'canal-plus':
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="5.4" fill="#000"/>` +
    `<text x="12" y="15.6" text-anchor="middle" fill="#fff" font-family="Arial Black, Impact, Arial, sans-serif" font-size="8" font-weight="900" letter-spacing="0.1">C+</text>` +
    `</svg>`,
  // ABC iview — live app icon (iview.abc.net.au/images/touchicon.png): white ABC lissajous over the
  // iview wordmark (play triangle in the e) on the iview teal tile, built from the checked-in
  // masthead SVG (icon-sources/abc-iview-logo.svg). See abcIviewIcon() for the layout numbers.
  'abc-iview': abcIviewIcon(),
  // CBC Gem — live app icon (gem.cbc.ca/android-chrome-512x512.png): the white CBC gem on the
  // Gem red tile, built from the checked-in header logo (icon-sources/cbc-gem-logo.svg). See
  // cbcGemIcon() for the layout numbers.
  'cbc-gem': cbcGemIcon(),
  'external-service':
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="5.4" fill="#546E7A"/>` +
    `<path fill="#fff" d="M10 7h7v7h-2V10.4l-6.3 6.3-1.4-1.4L13.6 9H10z"/>` +
    `</svg>`,
};

const assetEntries = assetIcons.map(([name, file]) => {
  const svg = fs.readFileSync(path.join(assetsDir, file), 'utf8').replace(/\r\n?/g, '\n').trim();
  return `  [${JSON.stringify(name)}, ${JSON.stringify(svg)}], // pragma: allowlist secret`;
});

const streamingEntries = Object.entries(streamingIconSvgs).map(
  ([name, svg]) => `  [${JSON.stringify(name)}, ${JSON.stringify(svg)}],`,
);

const entries = [...assetEntries, ...streamingEntries].join('\n');

const out = `/** Generated by tools/generate-svg-icon-literals.mjs — do not edit by hand. */
export const svgIconLiterals: ReadonlyArray<readonly [string, string]> = [
${entries}
];
`;

const check = process.argv.includes('--check');
if (check) {
  // Compare line endings normalised, so a CRLF working copy of the output isn't reported stale.
  const committed = fs.readFileSync(outFile, 'utf8').replace(/\r\n?/g, '\n');
  if (committed !== out) {
    console.error(
      `${path.relative(root, outFile)} is stale. Run npm run generate:svg-icons and commit the result.`,
    );
    process.exit(1);
  }
  console.log(
    `${path.relative(root, outFile)} is current (${assetEntries.length + streamingEntries.length} icons).`,
  );
} else {
  fs.writeFileSync(outFile, out);
  console.log(`Wrote ${assetEntries.length + streamingEntries.length} icon literals to ${path.relative(root, outFile)}`);
}
