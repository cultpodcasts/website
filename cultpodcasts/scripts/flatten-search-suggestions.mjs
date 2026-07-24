#!/usr/bin/env node
/**
 * Converts nested search-suggestions export → flat match index.
 *
 * Input (nested, from ExportSearchSuggestions or legacy asset):
 *   { generatedAtUtc, subjects: [{ name, aliases }], podcasts: string[] }
 *
 * Output (flat, for SearchSuggestionsService):
 *   { generatedAtUtc, entries: [{ type, canonical, searchText, alias? }] }
 *
 * Usage:
 *   node scripts/flatten-search-suggestions.mjs [in.json] [out.json]
 * Defaults: src/assets/search-suggestions.json (in-place if one arg / none).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const inPath = resolve(
  process.argv[2] ?? 'src/assets/search-suggestions.json'
);
const outPath = resolve(process.argv[3] ?? inPath);

const raw = JSON.parse(readFileSync(inPath, 'utf8'));

if (Array.isArray(raw.entries)) {
  console.log(`Already flat (${raw.entries.length} entries): ${inPath}`);
  if (outPath !== inPath) {
    writeFileSync(outPath, JSON.stringify(raw, null, 2) + '\n', 'utf8');
  }
  process.exit(0);
}

if (!Array.isArray(raw.subjects) || !Array.isArray(raw.podcasts)) {
  console.error('Expected nested { subjects, podcasts } or flat { entries }.');
  process.exit(1);
}

/** @type {{ type: string, canonical: string, searchText: string, alias?: string }[]} */
const entries = [];
const seen = new Set();

function add(type, canonical, sourceText, alias) {
  const searchText = sourceText.trim().toLowerCase();
  if (!searchText || !canonical.trim()) return;
  const key = `${type}\0${canonical}\0${searchText}`;
  if (seen.has(key)) return;
  seen.add(key);
  const row = { type, canonical: canonical.trim(), searchText };
  if (alias) row.alias = alias;
  entries.push(row);
}

for (const subject of raw.subjects) {
  const name = (subject?.name ?? '').trim();
  if (!name) continue;
  add('subject', name, name);
  for (const a of subject.aliases ?? []) {
    const alias = String(a).trim();
    if (!alias) continue;
    add('subject', name, alias, alias);
  }
}

for (const podcast of raw.podcasts) {
  const name = String(podcast ?? '').trim();
  if (!name) continue;
  add('podcast', name, name);
}

entries.sort((a, b) =>
  a.searchText.localeCompare(b.searchText) ||
  a.type.localeCompare(b.type) ||
  a.canonical.localeCompare(b.canonical)
);

const out = {
  generatedAtUtc: raw.generatedAtUtc ?? new Date().toISOString(),
  entries
};

writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(
  `Wrote ${entries.length} entries → ${outPath} ` +
  `(${raw.subjects.length} subjects, ${raw.podcasts.length} podcasts)`
);
