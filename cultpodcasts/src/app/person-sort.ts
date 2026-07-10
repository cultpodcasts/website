import { Person } from './person.interface';

/** Keywords that suggest an organization, show, or media brand rather than a person. */
const ORG_SORT_KEYWORDS = [
  'podcast',
  'news',
  'morning',
  'cnn',
  'channel',
  'fm',
  'am',
  'tv',
  'radio',
  'network',
  'show',
  'official',
  'bbc',
  'nbc',
  'abc',
  'cbs',
  'msnbc',
  'fox',
  'sky',
  'media',
  'press',
  'times',
  'post',
  'journal',
  'gazette',
  'tribune',
  'herald',
  'daily',
  'weekly',
  'magazine',
  'inc',
  'llc',
  'ltd',
  'corp',
  'company',
  'foundation',
  'institute',
  'ministry',
  'church',
  'temple',
  'university',
  'college',
  'school',
  'association',
  'society',
  'committee',
  'commission',
  'agency',
  'bureau',
  'department',
  'office',
  'group',
  'collective',
  'productions',
  'entertainment',
  'studios',
  'records',
];

const ORG_KEYWORD_PATTERN = new RegExp(
  `\\b(?:${ORG_SORT_KEYWORDS.map(escapeRegExp).join('|')})\\b`,
  'i'
);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Last whitespace-separated token of name (hyphenated tokens kept whole). */
export function deriveSortKeyFromName(name: string | null | undefined): string {
  if (!name?.trim()) {
    return '';
  }
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? '';
}

/** True when the name looks like an org, show, or media brand. */
export function looksLikeOrganization(name: string | null | undefined): boolean {
  const trimmed = name?.trim();
  if (!trimmed) {
    return false;
  }

  if (ORG_KEYWORD_PATTERN.test(trimmed)) {
    return true;
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length >= 5) {
    return true;
  }

  // Multi-word ALL CAPS (e.g. "CNN NEWS") — treat as brand/org.
  if (parts.length >= 2 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Suggested sort name for the UI while typing.
 * Orgs/shows → full name; otherwise last whitespace token (single token = that token).
 */
export function guessSortName(name: string | null | undefined): string {
  const trimmed = name?.trim() ?? '';
  if (!trimmed) {
    return '';
  }
  if (looksLikeOrganization(trimmed)) {
    return trimmed;
  }
  return deriveSortKeyFromName(trimmed);
}

/** Override when sortName is set; otherwise last token of name (server EffectiveSortKey). */
export function getEffectiveSortKey(person: Pick<Person, 'name' | 'sortName'> | { name: string; sortName?: string | null }): string {
  if (person.sortName?.trim()) {
    return person.sortName.trim();
  }
  return deriveSortKeyFromName(person.name);
}

export function comparePeopleBySortKey(a: Person, b: Person): number {
  const bySort = getEffectiveSortKey(a).localeCompare(getEffectiveSortKey(b));
  if (bySort !== 0) {
    return bySort;
  }
  return a.name.localeCompare(b.name);
}

/**
 * Value to persist: omit redundant last-token guesses (server derives them);
 * keep org full-name and manual overrides.
 */
export function sortNameForPersist(name: string, sortName: string | null | undefined, useFullName: boolean): string | null {
  const trimmed = sortName?.trim() ?? '';
  if (!trimmed) {
    return null;
  }
  if (useFullName) {
    return trimmed;
  }
  if (trimmed === deriveSortKeyFromName(name)) {
    return null;
  }
  return trimmed;
}
