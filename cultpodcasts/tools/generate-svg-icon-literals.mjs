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
  // iview wordmark (play triangle in the e) on the iview teal tile. Paths are the site's own
  // ABCIviewLogo masthead SVG, rounded to 2dp and placed at the app icon's proportions.
  'abc-iview':
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="5.4" fill="#2FB7B6"/>` +
    `<path fill="#fff" transform="matrix(.6226 0 0 .6226 4.43 -3)" d="M22.44 11.22C21.81 10.81 21.03 10.59 20.26 10.64C19.87 10.66 19.49 10.75 19.13 10.91C18.16 11.38 17.34 12.35 17.07 13.52L18.86 18.57L20.24 14.69L20.3 14.53V24.09L16.53 13.6C15.91 12.08 14.97 11.46 14.62 11.22C14.01 10.86 13.24 10.66 12.46 10.63C12.44 10.63 12.42 10.63 12.4 10.63C12.31 10.63 12.21 10.63 12.11 10.63C11.68 10.64 11.26 10.71 10.85 10.84C9.81 11.22 8.91 11.65 7.98 13.33L9.88 18.3L11.01 15.31C11.2 14.74 11.65 14.48 12.1 14.5C12.55 14.52 13.01 14.83 13.22 15.39L16.8 24.91C16.8 24.91 17.42 26.42 17.73 26.74C18.47 27.59 19.52 27.94 20.38 27.9C20.88 27.9 21.08 27.86 21.54 27.71C22.51 27.28 23.6 26.35 23.72 24.64V14.26C23.68 12.78 23.41 11.93 22.44 11.22ZM13.34 23.24C13.12 23.83 12.63 24.09 12.16 24.04C11.73 23.99 11.31 23.7 11.09 23.16L7.51 13.68C7.51 13.68 6.89 12.16 6.58 11.85C5.88 10.96 4.79 10.65 3.93 10.65C3.43 10.65 3.23 10.68 2.81 10.84C1.83 11.27 0.71 12.2 0.59 13.95V24.29C0.63 25.8 0.9 26.62 1.87 27.36C2.56 27.77 3.38 27.99 4.19 27.9C4.53 27.87 4.86 27.78 5.18 27.63C6.15 27.16 7 26.19 7.24 25.06L5.45 20.01L4.05 24.06V14.45L7.78 24.99C8.4 26.5 9.34 27.09 9.69 27.32C10.4 27.77 11.31 27.96 12.21 27.92C12.63 27.9 13.06 27.83 13.46 27.71C14.51 27.32 15.4 26.93 16.33 25.26L14.43 20.24L13.34 23.24Z"/>` +
    `<path fill="#fff" transform="matrix(.2011 0 0 .2011 -.79 14.6)" d="M76.92 10.64L80.28 22.62H80.55L83.9 10.64H88.12L91.51 22.62H91.74L95.16 10.64H99.41L93.61 27.89H89.57L86.04 16.24H85.78L82.39 27.89H78.34L72.68 10.64H76.92ZM64.99 24.52C62.03 24.52 59.63 22.09 59.63 19.09C59.63 16.09 62.03 13.65 64.99 13.65C67.94 13.65 70.35 16.09 70.35 19.09H73.77C73.77 14.17 69.84 10.18 64.99 10.18C60.13 10.18 56.2 14.17 56.2 19.09C56.2 24.01 60.13 28 64.99 28C68.61 28 71.71 25.78 73.06 22.61H69.07C68.08 23.78 66.62 24.52 64.99 24.52ZM50.99 10.64H55.07V27.9H50.99V10.64ZM37.34 10.64L41.49 23.15H41.75L45.87 10.64H50.05L43.63 27.9H39.51L33.25 10.64H37.34ZM28.12 10.64H32.2V27.9H28.12V10.64ZM32.47 6.34C32.47 5.05 31.42 4 30.13 4C28.84 4 27.8 5.05 27.8 6.34C27.8 7.63 28.84 8.67 30.13 8.67C31.42 8.67 32.47 7.63 32.47 6.34ZM70.34 19.09L63.3 23.21V14.97L70.34 19.09Z"/>` +
    `</svg>`,
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
