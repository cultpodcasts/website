/** Normalize podcast/subject names for display-alias lookup (not for filters or routes). */
function normalizeCatalogKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[''`´]/g, '')
    .replace(/\s+/g, ' ');
}

/** Display-only aliases keyed by normalized catalog name. */
const DISPLAY_ALIASES: ReadonlyMap<string, string> = new Map([
  [normalizeCatalogKey("Hustler's University"), 'Andrew Tate'],
]);

/**
 * User-visible label for a podcast or subject name.
 * Does not change routing, filtering, or API identifiers.
 */
export function displayCatalogName(name: string | null | undefined): string {
  if (name == null || name === '') {
    return name ?? '';
  }
  return DISPLAY_ALIASES.get(normalizeCatalogKey(name)) ?? name;
}
