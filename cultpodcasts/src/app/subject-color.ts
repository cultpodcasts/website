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
 * Sixteen hues spaced around the wheel (~22°) with varied saturation/lightness so chips
 * read as distinct characters on dark UI — not a single muted band stepped by hue alone.
 * Hex is frozen from hsl() so the mapping cannot drift. Every text-on-background pair
 * clears 7:1 (WCAG AAA for normal text) — asserted in subject-color.spec.ts.
 */
export const SUBJECT_COLORS: readonly SubjectColor[] = [
  { name: 'rose', background: '#37151e', border: '#842e44', text: '#f6acbf' },
  { name: 'scarlet', background: '#361916', border: '#7f352f', text: '#f6a9a2' },
  { name: 'coral', background: '#3d2714', border: '#8c592c', text: '#f7cca6' },
  { name: 'amber', background: '#352e13', border: '#7e6d2a', text: '#f6e49c' },
  { name: 'gold', background: '#353616', border: '#7c7f2f', text: '#f0f3a5' },
  { name: 'chartreuse', background: '#253215', border: '#54762e', text: '#cff2a6' },
  { name: 'lime', background: '#193518', border: '#357b32', text: '#aef1ac' },
  { name: 'mint', background: '#173625', border: '#317d54', text: '#a8f0ca' },
  { name: 'teal', background: '#14332f', border: '#2c7d72', text: '#abf2e9' },
  { name: 'cyan', background: '#153338', border: '#2d7a86', text: '#aeebf4' },
  { name: 'sky', background: '#142939', border: '#2c648c', text: '#add7f5' },
  { name: 'cobalt', background: '#151d38', border: '#2d4386', text: '#aabcf3' },
  { name: 'indigo', background: '#1f183a', border: '#423286', text: '#bdb0f2' },
  { name: 'violet', background: '#2b1537', border: '#652e84', text: '#d8aaf3' },
  { name: 'orchid', background: '#381537', border: '#862d83', text: '#f4a9f2' },
  { name: 'magenta', background: '#391429', border: '#882b61', text: '#f6a7d5' },
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
