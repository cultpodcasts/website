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

/** Max SI path already includes a rounded square — use as the full glyph. */
function selfBoxedIcon(pathD, fill = '#000') {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<path fill="${fill}" d="${pathD}"/>` +
    `</svg>`
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
  // Prime Video smile — SI wordmarks are illegible at 24px; keep branded smile.
  'amazon-prime':
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="5.4" fill="#232F3E"/>` +
    `<path fill="#fff" d="M7.2 9.1h1.5c.9 0 1.5.5 1.5 1.3 0 .7-.4 1.2-1 1.3l1.2 1.7h-1.1l-1.1-1.6H8.3v1.6H7.2V9.1zm1.1 1.9h.4c.4 0 .6-.2.6-.5s-.2-.5-.6-.5h-.4v1zm3.2-.1c0-1.3.9-2 2.1-2s2.1.7 2.1 2-.9 2-2.1 2-2.1-.7-2.1-2zm3.1 0c0-.7-.4-1.1-1-1.1s-1 .4-1 1.1.4 1.1 1 1.1 1-.4 1-1.1zm1.3 2.9V9.1h1.1v.5c.3-.4.8-.6 1.3-.6.9 0 1.5.6 1.5 1.6v2.3h-1.1v-2.1c0-.5-.3-.8-.7-.8-.5 0-.9.3-.9.9v2h-1.2z"/>` +
    `<path fill="#00A8E1" d="M6.2 15.2c1.9 1.1 4.1 1.7 6.5 1.7 1.6 0 3.2-.3 4.6-.8-.4.5-1.1.9-1.9 1.2-2.4.9-5.1.5-7.1-.8-.4-.3-.2-.8.3-.7 1.1.4 2.2.6 3.4.6 1.6 0 3.1-.4 4.4-1.1-2.1-.2-4.1-.8-5.8-1.7-.5-.3-.2-.9.4-.7 1 .5 2.1.8 3.2 1-1.7-.7-3.1-1.7-4.1-3-.3-.4.2-.8.6-.5 1.3.9 2.8 1.5 4.4 1.9"/>` +
    `</svg>`,
  'paramount-plus': boxedIcon('#0064FF', simpleIconPaths.paramountplus, { inset: 1.25 }),
  // Current Max mark (catalog key hboMax → icon hbo-max).
  'hbo-max': selfBoxedIcon(simpleIconPaths.max, '#000000'),
  // Play Suisse — no Simple Icons slug; Swiss-red tile with PS monogram.
  'play-suisse':
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="5.4" fill="#E30613"/>` +
    `<path fill="#fff" d="M6.8 7.2h4.2c1.9 0 3.1 1.1 3.1 2.7 0 1.2-.7 2.1-1.8 2.5L14.8 16.8h-2.5l-2.3-4.1H9.1v4.1H6.8V7.2zm2.3 2v2.6h1.7c.9 0 1.4-.5 1.4-1.3S11.7 9.2 10.8 9.2H9.1z"/>` +
    `<path fill="#fff" d="M16.2 11.2h1.5v-1.5H19v1.5h1.5v1.5H19v1.5h-1.3v-1.5h-1.5z"/>` +
    `</svg>`,
  // TVNZ+ — no SI slug; dark tile + cyan TVNZ bar and plus.
  'tvnz-plus':
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="5.4" fill="#111"/>` +
    `<path fill="#00AEEF" d="M5.6 7.6h12.8v2.2H13.6v6.6h-3.2V9.8H5.6z"/>` +
    `<path fill="#fff" d="M16.2 13.4h1.5v-1.5h1.5v1.5H20.7v1.5h-1.5v1.5h-1.5v-1.5h-1.5z"/>` +
    `</svg>`,
  // ITVX — SI wordmark+X in brand lime on dark (not the old blue “T”).
  itvx: boxedIcon('#0B1C2C', simpleIconPaths.itvx, { fg: '#DEEB52', inset: 1.5 }),
  // Channel 4 geometric 4 in brand lime on black.
  channel4: boxedIcon('#111111', simpleIconPaths.channel4, { fg: '#AAFF89', inset: 1.25 }),
  // Fawesome — no SI slug; orange tile with bold F.
  fawesome:
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="5.4" fill="#FF6A00"/>` +
    `<path fill="#fff" d="M7.4 6.8h9.2v2.3H9.8v2.2h6.2v2.2H9.8v4.5H7.4z"/>` +
    `</svg>`,
  // Disney+ — no current SI slug; Disney blue + Mickey ears cue and plus.
  'disney-plus':
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="5.4" fill="#113CCF"/>` +
    `<circle cx="8.2" cy="9.2" r="2.1" fill="#fff"/>` +
    `<circle cx="15.8" cy="9.2" r="2.1" fill="#fff"/>` +
    `<circle cx="12" cy="12.2" r="3.4" fill="#fff"/>` +
    `<path fill="#113CCF" d="M12 10.4c-1.2 0-2.1.9-2.1 2.1S10.8 14.6 12 14.6s2.1-.9 2.1-2.1-.9-2.1-2.1-2.1z"/>` +
    `<path fill="#fff" d="M16.4 15.6h1.4v-1.4H19v1.4h1.4v1.4H19v1.4h-1.2v-1.4h-1.4z"/>` +
    `</svg>`,
  // discovery+ — no SI slug; yellow D disc + plus.
  'discovery-plus':
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="5.4" fill="#111"/>` +
    `<circle cx="11.2" cy="12" r="5.4" fill="#F5C518"/>` +
    `<path fill="#111" d="M9.2 8.6h2.1c2.2 0 3.6 1.4 3.6 3.4s-1.4 3.4-3.6 3.4H9.2V8.6zm2.1 5.2c1.1 0 1.8-.7 1.8-1.8s-.7-1.8-1.8-1.8h-.7v3.6h.7z"/>` +
    `<path fill="#fff" d="M16.6 13.2h1.4v-1.4H19.4v1.4h1.4v1.4h-1.4v1.4h-1.4v-1.4h-1.4z"/>` +
    `</svg>`,
  'external-service':
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="5.4" fill="#546E7A"/>` +
    `<path fill="#fff" d="M10 7h7v7h-2V10.4l-6.3 6.3-1.4-1.4L13.6 9H10z"/>` +
    `</svg>`,
};

const assetEntries = assetIcons.map(([name, file]) => {
  const svg = fs.readFileSync(path.join(assetsDir, file), 'utf8').trim();
  return `  [${JSON.stringify(name)}, ${JSON.stringify(svg)}]`;
});

const streamingEntries = Object.entries(streamingIconSvgs).map(
  ([name, svg]) => `  [${JSON.stringify(name)}, ${JSON.stringify(svg)}]`,
);

const entries = [...assetEntries, ...streamingEntries].join(',\n');

const out = `/** Generated by tools/generate-svg-icon-literals.mjs — do not edit by hand. */
export const svgIconLiterals: ReadonlyArray<readonly [string, string]> = [
${entries}
];
`;

fs.writeFileSync(outFile, out);
console.log(`Wrote ${assetEntries.length + streamingEntries.length} icon literals to ${path.relative(root, outFile)}`);
