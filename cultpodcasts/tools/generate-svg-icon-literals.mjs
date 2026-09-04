import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.resolve(root, '../src/assets');
const outFile = path.resolve(root, '../src/app/svg-icon-literals.ts');

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
 * Compact streaming / service mark SVGs (no separate asset files).
 * Edit these strings here, then regenerate — do not hand-edit svg-icon-literals.ts.
 */
const streamingIconSvgs = {
  "vimeo": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><rect width=\"24\" height=\"24\" rx=\"5.4\" fill=\"#1ab7ea\"/><path fill=\"#fff\" d=\"M19.2 9.1c-.1 2.2-1.6 5.2-4.6 9h-4.7L8.4 12c.8 1.6 1.7 3.3 2.4 4.9.7-2.3 1.4-4.6 1.5-6.1.1-1.1-.3-1.8-1.3-1.6-.5.1-1.1.5-1.7 1l-1-1.3C9.4 7.8 10.6 7 12.1 7c2.2 0 3.3 1.2 3.4 3.5.4-1.3 1.5-1.9 2.7-1.8.7 0 1.1.2 1 1.4z\"/></svg>",
  "netflix": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><rect width=\"24\" height=\"24\" rx=\"5.4\" fill=\"#141414\"/><path fill=\"#e50914\" d=\"M8 5h2.4l3.2 8.2V5H16v14h-2.4L10.4 10.8V19H8z\"/></svg>",
  "amazon-prime": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><rect width=\"24\" height=\"24\" rx=\"5.4\" fill=\"#232f3e\"/><path fill=\"#00a8e1\" d=\"M6.5 14.2c2.4 1.4 5.3 2.2 8.4 2.2 1.8 0 3.5-.3 5.1-.8-.6.7-1.5 1.3-2.6 1.7-3.2 1.3-6.7.7-9.3-1.1-.5-.3-.2-1 .4-.8 1.3.5 2.7.8 4.2.8 1.4 0 2.8-.3 4-.8-2.4-.4-4.7-1.1-6.7-2.1-.6-.3-.3-1.1.3-.9 1.3.6 2.7 1.1 4.2 1.4-2.1-.8-3.9-2-5.3-3.5-.4-.4.1-.9.6-.6 1.6 1.1 3.4 1.9 5.4 2.4-1.6-1.2-2.8-2.8-3.5-4.6-.2-.5.5-.8.8-.4.9 1.4 2.1 2.6 3.6 3.5.4-2.3 1.6-4.1 3.4-5.1.5-.3 1 .4.7.8-1.3.9-2.1 2.3-2.4 4 .2 0 .3-.1.5-.1 1.6-.3 2.8.8 2.6 2.2-.1 1.2-1.2 2-2.6 1.9-1.1-.1-2-.8-2.3-1.8-.9-.3-1.9-.7-2.8-1.1z\"/></svg>",
  "paramount-plus": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><rect width=\"24\" height=\"24\" rx=\"5.4\" fill=\"#0064ff\"/><path fill=\"#fff\" d=\"M12 5.2 4.8 18h3.1l1.5-2.7h5.2L16.1 18h3.1L12 5.2zm0 4.1 1.7 3.1h-3.4L12 9.3z\"/></svg>",
  "hbo-max": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><rect width=\"24\" height=\"24\" rx=\"5.4\" fill=\"#000\"/><path fill=\"#7c3aed\" d=\"M5 7.5h2.2v3.1h2.8V7.5H12.2v9H10V13.2H7.2v3.3H5zm8.3 0h2.1l1.4 4.4 1.4-4.4h2.1L18.4 16.5h-2.2l-.6-2.2-.6 2.2h-2.2z\"/></svg>",
  "play-suisse": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><rect width=\"24\" height=\"24\" rx=\"5.4\" fill=\"#e30613\"/><path fill=\"#fff\" d=\"M9.2 7.2h5.8c1.7 0 2.8 1 2.8 2.5 0 1.1-.6 1.9-1.6 2.2 1.2.3 2 1.2 2 2.5 0 1.7-1.3 2.9-3.3 2.9H9.2V7.2zm2.4 3.8h3c.7 0 1.1-.4 1.1-1s-.4-1-1.1-1h-3v2zm0 4.4h3.4c.8 0 1.2-.4 1.2-1.1s-.4-1.1-1.2-1.1h-3.4v2.2z\"/></svg>",
  "tvnz-plus": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><rect width=\"24\" height=\"24\" rx=\"5.4\" fill=\"#111\"/><path fill=\"#00aeef\" d=\"M6 7.4h12v2.1h-4.6V16.6h-2.8V9.5H6z\"/><path fill=\"#fff\" d=\"M16.4 13.1h1.4v-1.4h1.4v1.4H20.6v1.4h-1.4v1.4h-1.4v-1.4h-1.4z\"/></svg>",
  "itvx": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><rect width=\"24\" height=\"24\" rx=\"5.4\" fill=\"#0074c9\"/><path fill=\"#fff\" d=\"M7 7.2h10v2.2H13.6V16.8H10.4V9.4H7z\"/></svg>",
  "channel4": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><rect width=\"24\" height=\"24\" rx=\"5.4\" fill=\"#111\"/><path fill=\"#fff\" d=\"M8.2 7.4 13.4 12 8.2 16.6V14H5.6v-4h2.6V7.4zm5.6 0H18.8v9.2h-5z\"/></svg>",
  "fawesome": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><rect width=\"24\" height=\"24\" rx=\"5.4\" fill=\"#ff6a00\"/><path fill=\"#fff\" d=\"M7.2 7.2h9.6v2.1H9.6v2.1h6.6v2.1H9.6v3.3H7.2z\"/></svg>",
  "disney-plus": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><rect width=\"24\" height=\"24\" rx=\"5.4\" fill=\"#113ccf\"/><path fill=\"#fff\" d=\"M6.4 15.2c2.4-4.8 6.6-8 10.8-9.2.4 1.2.6 2.4.6 3.6 0 3.4-1.6 6.4-4.2 8.2-1.2-2.4-1.8-5-1.8-7.6 0-.8.1-1.6.2-2.4-2.6 1.6-4.6 4-5.6 7.4z\"/><path fill=\"#fff\" d=\"M16.2 12.4h1.4v-1.4H19v1.4h1.4v1.4H19v1.4h-1.4v-1.4h-1.4z\"/></svg>",
  "discovery-plus": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><rect width=\"24\" height=\"24\" rx=\"5.4\" fill=\"#111\"/><circle cx=\"12\" cy=\"12\" r=\"5.2\" fill=\"#f5c518\"/><path fill=\"#111\" d=\"M16.4 12.4h1.3v-1.3h1.3v1.3H20.3v1.3h-1.3v1.3h-1.3v-1.3h-1.3z\"/></svg>",
  "external-service": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><rect width=\"24\" height=\"24\" rx=\"5.4\" fill=\"#546e7a\"/><path fill=\"#fff\" d=\"M10 7h7v7h-2V10.4l-6.3 6.3-1.4-1.4L13.6 9H10z\"/></svg>",
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
