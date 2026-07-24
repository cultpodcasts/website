/**
 * Deterministic colour per subject, so a group keeps the same colour everywhere its chip
 * appears — homepage rails, search results, podcast pages — and across sessions and builds.
 * Colour is derived from the subject's canonical name only; nothing about the episode,
 * the ordering of results, or the current session can shift it.
 */
export interface SubjectColor {
  /** Stable palette id. Diagnostics and tests only — never shown to users. */
  name: string;
  background: string;
  border: string;
  text: string;
}

/**
 * Hues spread around the wheel at fixed saturation/lightness bands: a dark muted background
 * with light same-hue text and a mid-tone border. Generated from hsl(h, 38%, 15%) /
 * hsl(h, 42%, 34%) / hsl(h, 78%, 80%) and then frozen as hex so the mapping cannot drift.
 * Every text-on-background pair clears 7:1 (WCAG AAA for normal text) — asserted in
 * subject-color.spec.ts, so editing this table cannot silently break contrast.
 */
export const SUBJECT_COLORS: readonly SubjectColor[] = [
  { name: 'crimson', background: '#35181c', border: '#7b323c', text: '#f4a4af' },
  { name: 'ember', background: '#352018', border: '#7b4832', text: '#f4bca4' },
  { name: 'amber', background: '#352a18', border: '#7b6032', text: '#f4d7a4' },
  { name: 'gold', background: '#353418', border: '#7b7932', text: '#f4f1a4' },
  { name: 'lime', background: '#283518', border: '#5c7b32', text: '#d1f4a4' },
  { name: 'fern', background: '#183521', border: '#327b4b', text: '#a4f4bf' },
  { name: 'jade', background: '#18352f', border: '#327b6d', text: '#a4f4e4' },
  { name: 'teal', background: '#183035', border: '#326f7b', text: '#a4e7f4' },
  { name: 'azure', background: '#182535', border: '#32547b', text: '#a4c9f4' },
  { name: 'indigo', background: '#181935', border: '#32357b', text: '#a4a7f4' },
  { name: 'violet', background: '#251835', border: '#54327b', text: '#c9a4f4' },
  { name: 'magenta', background: '#351831', border: '#7b3271', text: '#f4a4e9' },
];

/**
 * Canonical identity of a subject for colour lookup: case, surrounding whitespace,
 * apostrophe style and internal whitespace runs must not produce a different colour.
 * Mirrors the display-alias normalization in display-catalog-name.
 */
export function subjectColorKey(subject: string): string {
  return subject
    .trim()
    .toLowerCase()
    // Straight, typographic and modifier apostrophes plus backtick/acute all read as the same name.
    .replace(/['\u2018\u2019\u02bc\u0060\u00b4]/g, '')
    .replace(/\s+/g, ' ');
}

/** Palette entry for a subject. Empty/missing names get a valid colour rather than no chip. */
export function subjectColor(subject: string | null | undefined): SubjectColor {
  const key = subject ? subjectColorKey(subject) : '';
  return SUBJECT_COLORS[fnv1aHash(key) % SUBJECT_COLORS.length];
}

/** FNV-1a — fixed arithmetic with no engine-specific behaviour, so colours never shift between releases. */
function fnv1aHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
