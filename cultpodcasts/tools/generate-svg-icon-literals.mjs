// pragma: allowlist secret
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
  ['cultpodcasts', 'cultpodcasts.svg'], // pragma: allowlist secret
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

/**
 * Compact streaming / service mark SVGs (no separate asset files).
 * Prefer Simple Icons paths (tools/icon-sources) boxed to 24×24.
 * Edit here (or refresh paths.json), then regenerate — do not hand-edit svg-icon-literals.ts.
 */
const streamingIconSvgs = {
  vimeo: boxedIcon('#1AB7EA', simpleIconPaths.vimeo),
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
  // Max (catalog: HBO Max) — live max.com apple-touch: white O (ring) on black.
  // Do NOT use SI "max" as-is (self-boxed black glyph — invisible on dark chrome).
  'hbo-max':
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="5.4" fill="#000"/>` +
    `<circle cx="12" cy="12" r="8.2" fill="#fff"/>` +
    `<circle cx="12" cy="12" r="5.05" fill="#000"/>` +
    `</svg>`,
  // Play Suisse — live apple-touch: Swiss red tile, white chevron + plus.
  'play-suisse':
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="5.4" fill="#E31F2B"/>` +
    `<path fill="#fff" d="M4.2 6.2l1.9-1.2 7.2 7-7.2 7-1.9-1.2 5.4-5.8z"/>` +
    `<path fill="#fff" d="M14.2 9.2h2.7V6.5h2.4v2.7H22v2.4h-2.7v2.7h-2.4v-2.7h-2.7z"/>` +
    `</svg>`,
  // Play RTS — SRG SSR red tile with RTS wordmark (matches live rts.ch icon).
  'play-rts':
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="5.4" fill="#BE1431"/>` +
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
  // ITVX — SI wordmark+X in brand lime on dark (not the old blue “T”).
  itvx: boxedIcon('#0B1C2C', simpleIconPaths.itvx, { fg: '#DEEB52', inset: 1.5 }),
  // Channel 4 geometric 4 in brand lime on black.
  channel4: boxedIcon('#111111', simpleIconPaths.channel4, { fg: '#AAFF89', inset: 1.25 }),
  // Fawesome — live apple-touch: navy tile, three white triangles (not a generic F).
  fawesome:
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="5.4" fill="#0E0E21"/>` +
    `<path fill="#fff" d="M5.15 3.45h5.35L8.05 13.7z"/>` +
    `<path fill="#fff" d="M13.5 3.45h5.35L16.2 13.7z"/>` +
    `<path fill="#fff" d="M12 13.05l2.7 7.35H9.3z"/>` +
    `</svg>`,
  // Disney+ — live favicon: aurora gradient + Disney script wordmark and plus (not Mickey ears).
  'disney-plus':
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<defs><linearGradient id="cp-disney-aurora" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" stop-color="#0A3048"/><stop offset="100%" stop-color="#2EC8D2"/>` +
    `</linearGradient></defs>` +
    `<rect width="24" height="24" rx="5.4" fill="url(#cp-disney-aurora)"/>` +
    `<path fill="none" stroke="#fff" stroke-width="1.15" stroke-linecap="round" d="M3.4 8.6c3.4-2.8 8.6-3.4 13.2-.4 1.6 1.1 3.2 3.4 4 6"/>` +
    `<text x="2.1" y="15.4" fill="#fff" font-family="Georgia, 'Times New Roman', Times, serif" font-style="italic" font-size="7.1" font-weight="700">Disney</text>` +
    `<text x="18.7" y="16.1" fill="#fff" font-family="Arial, Helvetica, sans-serif" font-size="8.2" font-weight="400">+</text>` +
    `</svg>`,
  // discovery+ — live apple-touch: white tile, rainbow d-bowl + glossy globe (not outlined d on black). // pragma: allowlist secret
  'discovery-plus': // pragma: allowlist secret
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<defs>` +
    `<linearGradient id="cp-discovery-bowl" x1="0%" y1="100%" x2="100%" y2="0%">` + // pragma: allowlist secret
    `<stop offset="0%" stop-color="#3B6BFF"/><stop offset="22%" stop-color="#7B2FFF"/>` +
    `<stop offset="48%" stop-color="#FF2D8A"/><stop offset="72%" stop-color="#FF7A1A"/>` +
    `<stop offset="100%" stop-color="#FFD400"/>` +
    `</linearGradient>` +
    `<radialGradient id="cp-discovery-globe" cx="38%" cy="38%" r="62%">` + // pragma: allowlist secret
    `<stop offset="0%" stop-color="#9EC5FF"/><stop offset="45%" stop-color="#5A6BFF"/>` +
    `<stop offset="100%" stop-color="#3A1EE0"/>` +
    `</radialGradient>` +
    `</defs>` +
    `<rect width="24" height="24" rx="5.4" fill="#F4F4F4"/>` +
    `<path fill="url(#cp-discovery-bowl)" fill-rule="evenodd" d="M14.85 2.15a9.75 9.75 0 1 1 0 19.5 9.75 9.75 0 0 1 0-19.5zm-1.55 3.7a6.55 6.55 0 1 0 0 13.1 6.55 6.55 0 0 0 0-13.1z"/>` + // pragma: allowlist secret
    `<circle cx="8.35" cy="12" r="5.7" fill="url(#cp-discovery-globe)"/>` + // pragma: allowlist secret
    `</svg>`,
  // BitChute — official favicon: red C (opens right) with a small lower-left play cut. // pragma: allowlist secret
  // Path traced from https://www.bitchute.com/static/icons/favicon-128x128.png // pragma: allowlist secret
  bitchute: // pragma: allowlist secret
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="5.4" fill="#111"/>` +
    `<path fill="#EF4137" d="M9.56 21.85C3.29 20.34 0.08 13.31 2.96 7.42C3.77 5.77 5.77 3.77 7.42 2.96C10.90 1.26 15.30 1.65 18.11 3.90L18.46 4.18L16.66 5.64L14.87 7.10L14.10 6.75C12.93 6.22 10.97 6.26 9.71 6.84C7.70 7.77 6.41 9.68 6.40 11.76C6.40 12.37 6.44 13.08 6.50 13.35C6.61 13.81 6.54 13.89 4.97 15.16C4.07 15.89 3.35 16.50 3.36 16.52C3.38 16.54 4.30 16.30 5.42 16.00L7.44 15.45L8.15 16.11C9.31 17.17 10.41 17.60 12.00 17.60C13.12 17.60 13.49 17.53 14.24 17.18C15.87 16.42 17.05 15.04 17.51 13.34L17.68 12.71L19.69 12.17C20.80 11.88 21.80 11.61 21.91 11.57C22.19 11.46 22.16 13.08 21.86 14.37C21.43 16.20 20.61 17.61 19.11 19.11C17.61 20.61 16.20 21.43 14.37 21.86C13.10 22.16 10.81 22.15 9.56 21.85Z"/>` +
    `</svg>`,
  'external-service':
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="5.4" fill="#546E7A"/>` +
    `<path fill="#fff" d="M10 7h7v7h-2V10.4l-6.3 6.3-1.4-1.4L13.6 9H10z"/>` +
    `</svg>`,
};

const assetEntries = assetIcons.map(([name, file]) => {
  const svg = fs.readFileSync(path.join(assetsDir, file), 'utf8').trim();
  return `  [${JSON.stringify(name)}, ${JSON.stringify(svg)}], // pragma: allowlist secret`;
});

const streamingEntries = Object.entries(streamingIconSvgs).map(
  ([name, svg]) => `  [${JSON.stringify(name)}, ${JSON.stringify(svg)}], // pragma: allowlist secret`,
);

const entries = [...assetEntries, ...streamingEntries].join('\n');

const out = `/** Generated by tools/generate-svg-icon-literals.mjs — do not edit by hand. */
// pragma: allowlist secret
export const svgIconLiterals: ReadonlyArray<readonly [string, string]> = [
${entries}
];
`;

fs.writeFileSync(outFile, out);
console.log(`Wrote ${assetEntries.length + streamingEntries.length} icon literals to ${path.relative(root, outFile)}`);
