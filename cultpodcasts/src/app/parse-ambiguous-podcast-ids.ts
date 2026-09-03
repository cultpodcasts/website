/** RFC 4122 UUID (same shape as OpenAPI z.string().uuid()). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Parses GET /podcast/{name} 409 body: a JSON array of podcast ids.
 * Returns undefined when the payload is not a UUID list.
 */
export function parseAmbiguousPodcastIds(body: unknown): string[] | undefined {
  if (!Array.isArray(body) || body.length === 0) {
    return undefined;
  }
  const ids: string[] = [];
  for (const item of body) {
    if (typeof item !== 'string' || !UUID_RE.test(item)) {
      return undefined;
    }
    ids.push(item);
  }
  return ids;
}
