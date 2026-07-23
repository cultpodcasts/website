/**
 * Coerce reactive-form control values into API/entity-friendly shapes.
 * Blank/nullish becomes an empty sentinel rather than null/undefined.
 */

/** Treat blank/nullish as empty string. */
export function asEmptyString(value: string | undefined | null): string {
  if (value) return value;
  return '';
}

/**
 * Accept `string[]` or a comma-separated string; blank/nullish → `[]`.
 * Trims and drops empty segments when splitting a string.
 */
export function asStringArray(value: string[] | string | undefined | null): string[] {
  if (value) {
    const valueAny: any = value;
    if (valueAny.push) {
      return value as string[];
    } else if (valueAny.split) {
      const valueString: string = valueAny;
      return valueString.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
    }
  }
  return [];
}

/** Blank/nullish Guid-like field → all-zero Guid sentinel. */
export function emptyGuidIfBlank(value: string | undefined | null): string {
  if (value) return value;
  return '00000000-0000-0000-0000-000000000000';
}
