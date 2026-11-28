/** A canonical 8-4-4-4-12 GUID, any case. */
export const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether the text is a bare GUID (for example a pasted parent id, as opposed to a name). Blank and missing are not. */
export function isGuidText(text: string | null | undefined): boolean {
  return !!text && GUID_PATTERN.test(text);
}