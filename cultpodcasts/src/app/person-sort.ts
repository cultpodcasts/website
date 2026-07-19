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

/** Strip leading "The " for corp/entity sort keys (display Name unchanged). */
export function stripLeadingThe(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? '';
  if (trimmed.length >= 4 && /^the\s+/i.test(trimmed)) {
    return trimmed.replace(/^the\s+/i, '').trimStart();
  }
  return trimmed;
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
 * Orgs/shows → StripLeadingThe(full name); otherwise last whitespace token.
 */
export function guessSortName(name: string | null | undefined): string {
  const trimmed = name?.trim() ?? '';
  if (!trimmed) {
    return '';
  }
  if (looksLikeOrganization(trimmed)) {
    return stripLeadingThe(trimmed);
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
 * Persist null ONLY when effective key equals last-token surname default.
 * Explicit useFullName (organization checkbox): always StripLeadingThe(Name).
 * Heuristic org path: same full-name key. Keep other overrides.
 */
export function sortNameForPersist(name: string, sortName: string | null | undefined, useFullName: boolean): string | null {
  const trimmedName = name?.trim() ?? '';
  const lastToken = deriveSortKeyFromName(trimmedName);

  // Curator organization flag: force full-name key even when Sort name still shows a surname.
  if (useFullName) {
    const orgKey = stripLeadingThe(trimmedName);
    if (!orgKey || orgKey === lastToken) {
      return null;
    }
    return orgKey;
  }

  const isOrg = looksLikeOrganization(trimmedName);
  const orgKey = isOrg ? stripLeadingThe(trimmedName) : '';

  let effective = sortName?.trim() ?? '';
  if (effective) {
    if (isOrg && orgKey) {
      const stripped = stripLeadingThe(effective);
      if (
        effective.toLowerCase() === trimmedName.toLowerCase() ||
        stripped.toLowerCase() === orgKey.toLowerCase() ||
        /^the\s+/i.test(effective)
      ) {
        effective = orgKey;
      }
    }
  } else if (isOrg && orgKey) {
    effective = orgKey;
  } else {
    effective = lastToken;
  }

  if (!effective || effective === lastToken) {
    return null;
  }
  return effective;
}

/** Sort-name value to show when Organization is checked (full name, strip leading The). */
export function organizationSortName(name: string | null | undefined): string {
  return stripLeadingThe(name?.trim() ?? '');
}
