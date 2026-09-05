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

/**
 * Compact streaming / service mark SVGs (no separate asset files).
 * Prefer Simple Icons paths (tools/icon-sources) boxed to 24×24.
 * Edit here (or refresh paths.json), then regenerate — do not hand-edit svg-icon-literals.ts.
 */
const streamingIconSvgs = {
  vimeo: boxedIcon('#1AB7EA', simpleIconPaths.vimeo),
  // Netflix N on near-black (SI path is the N glyph).
  netflix: boxedIcon('#141414', simpleIconPaths.netflix, { fg: '#E50914', inset: 1.5 }),
  // Prime Video — navy + white "prime" + cyan smile arrow (SI wordmarks illegible at 24px).
  'amazon-prime':
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="5.4" fill="#232F3E"/>` +
    `<text x="12" y="11.2" text-anchor="middle" fill="#fff" font-family="Arial, Helvetica, sans-serif" font-size="5.6" font-weight="700" letter-spacing="0.2">prime</text>` +
    `<path fill="none" stroke="#00A8E1" stroke-width="1.7" stroke-linecap="round" d="M4.8 14.1c2.6 2.2 5.5 3.3 8.9 3.3 1.8 0 3.5-.3 5-.9"/>` +
    `<path fill="#00A8E1" d="M17.4 14.8l3.2.9-2.4 2.4z"/>` +
    `</svg>`,
  'paramount-plus': boxedIcon('#0064FF', simpleIconPaths.paramountplus, { inset: 1.25 }),
  // HBO Max — stacked HBO (O with inner circle) / max; light on near-black for dark UI.
  // Do NOT use SI "max" (black self-boxed glyph — invisible on dark chrome).
  'hbo-max':
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="5.4" fill="#1A1A1A"/>` +
    `<text x="2.6" y="10" fill="#F5F5F5" font-family="Arial Black, Impact, Arial, sans-serif" font-size="6.5" font-weight="900" letter-spacing="0.08">HB</text>` +
    `<circle cx="16.35" cy="7.9" r="2.55" fill="#F5F5F5"/>` +
    `<circle cx="16.35" cy="7.9" r="1.15" fill="#1A1A1A"/>` +
    `<text x="3" y="17.8" fill="#F5F5F5" font-family="Arial, Helvetica, sans-serif" font-size="6.6" font-weight="400" letter-spacing="0.35">max</text>` +
    `</svg>`,
  // Play Suisse — official >+ glyph on dark (not red R+).
  'play-suisse':
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<rect width="24" height="24" rx="5.4" fill="#111111"/>` +
    `<path fill="#E8E8E8" d="M4.2 6.2l1.9-1.2 7.2 7-7.2 7-1.9-1.2 5.4-5.8z"/>` +
    `<path fill="#E8E8E8" d="M14.2 9.2h2.7V6.5h2.4v2.7H22v2.4h-2.7v2.7h-2.4v-2.7h-2.7z"/>` +
    `</svg>`,
  // TVNZ+ — white lowercase wordmark + blue→cyan gradient plus.
  'tvnz-plus':
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<defs><linearGradient id="cp-tvnz-plus-grad" x1="0%" y1="100%" x2="100%" y2="0%">` +
    `<stop offset="0%" stop-color="#0057FF"/><stop offset="100%" stop-color="#00E5FF"/>` +
    `</linearGradient></defs>` +
    `<rect width="24" height="24" rx="5.4" fill="#000"/>` +
    `<text x="2.2" y="15.1" fill="#fff" font-family="Arial Black, Impact, Arial, sans-serif" font-size="7" font-weight="900" letter-spacing="-0.4">tvnz</text>` +
    `<path fill="url(#cp-tvnz-plus-grad)" d="M17.6 8h1.7v2.2h2.2v1.7h-2.2v2.2h-1.7v-2.2h-2.2v-1.7h2.2z"/>` +
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
  // discovery+ — white outlined lowercase d with rainbow globe (not yellow D + plus).
  'discovery-plus':
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">` +
    `<defs><linearGradient id="cp-discovery-globe" x1="0%" y1="100%" x2="100%" y2="0%">` +
    `<stop offset="0%" stop-color="#2E7DFF"/><stop offset="20%" stop-color="#7B2FFF"/>` +
    `<stop offset="40%" stop-color="#FF2D8A"/><stop offset="60%" stop-color="#FF7A1A"/>` +
    `<stop offset="80%" stop-color="#FFD400"/><stop offset="100%" stop-color="#2ECC71"/>` +
    `</linearGradient></defs>` +
    `<rect width="24" height="24" rx="5.4" fill="#0D0D0D"/>` +
    `<path fill="#fff" d="M6.2 5.2h5.1c4.05 0 6.7 2.55 6.7 6.8s-2.65 6.8-6.7 6.8H6.2V5.2zm3.05 2.55v8.5h2.05c2.45 0 3.85-1.55 3.85-4.25s-1.4-4.25-3.85-4.25H9.25z"/>` +
    `<circle cx="12.35" cy="12" r="3.55" fill="url(#cp-discovery-globe)"/>` +
    `<circle cx="12.35" cy="12" r="2.15" fill="#0D0D0D"/>` +
    `<ellipse cx="12.35" cy="12" rx="1.05" ry="2.15" fill="none" stroke="#fff" stroke-width="0.45" opacity="0.55"/>` +
    `<path fill="none" stroke="#fff" stroke-width="0.45" opacity="0.55" d="M10.2 12h4.3M11 10.1h2.7M11 13.9h2.7"/>` +
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
