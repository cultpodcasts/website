import { describe, expect, it } from 'vitest';
import { RedirectLookup, renamedSeriesRedirect } from './kv-redirect';

function store(entries: Record<string, string>): RedirectLookup & { keys: string[] } {
  const keys: string[] = [];
  return {
    keys,
    get: async (key: string) => {
      keys.push(key);
      return entries[key] ?? null;
    }
  };
}

const origin = 'https://example.test';

describe('renamedSeriesRedirect', () => {
  it('keeps the podcast redirect: bare KV key, rest of the path kept', async () => {
    const kv = store({ 'Old Show': 'New Show' });
    const target = await renamedSeriesRedirect(new URL(`${origin}/podcast/Old%20Show/episode-1`), kv);
    expect(kv.keys).toEqual(['Old Show']);
    expect(target?.pathname).toBe('/podcast/New%20Show/episode-1');
  });

  it('returns null for a malformed podcast escape instead of throwing', async () => {
    const kv = store({});
    await expect(renamedSeriesRedirect(new URL(`${origin}/podcast/%E0/episode`), kv)).resolves.toBeNull();
    expect(kv.keys).toEqual([]);
  });

  it('returns null for a podcast with no KV entry', async () => {
    expect(await renamedSeriesRedirect(new URL(`${origin}/podcast/Same`), store({}))).toBeNull();
  });

  it('redirects /news/{old} via KV key news/{old}', async () => {
    const kv = store({ 'news/Old Desk': 'New Desk' });
    const target = await renamedSeriesRedirect(new URL(`${origin}/news/Old%20Desk`), kv);
    expect(kv.keys).toEqual(['news/Old Desk']);
    expect(target?.href).toBe(`${origin}/news/New%20Desk`);
  });

  it('redirects /tv/{old}/ via KV key tv/{old} and keeps the query string', async () => {
    const kv = store({ 'tv/Old Nightly': 'New Nightly' });
    const target = await renamedSeriesRedirect(new URL(`${origin}/tv/Old%20Nightly/?ref=x`), kv);
    expect(target?.href).toBe(`${origin}/tv/New%20Nightly?ref=x`);
  });

  it('does not use the podcast key space for hubs', async () => {
    const kv = store({ 'Old Desk': 'Podcast Name' });
    expect(await renamedSeriesRedirect(new URL(`${origin}/news/Old%20Desk`), kv)).toBeNull();
    expect(kv.keys).toEqual(['news/Old Desk']);
  });

  it('ignores item paths, /film/ and other prefixes without a KV read', async () => {
    const kv = store({ 'news/Desk': 'Other', 'film/Desk': 'Other', 'tv/Desk': 'Other' });
    for (const path of ['/news/Desk/report-1', '/tv/Desk/episode-1', '/film/Desk', '/news/', '/news', '/subject/Desk']) {
      expect(await renamedSeriesRedirect(new URL(origin + path), kv)).toBeNull();
    }
    expect(kv.keys).toEqual([]);
  });

  it('skips self-redirects, names with "/", and malformed escapes', async () => {
    const kv = store({ 'news/Loop': 'Loop', 'tv/Slash': 'A/B' });
    expect(await renamedSeriesRedirect(new URL(`${origin}/news/Loop`), kv)).toBeNull();
    expect(await renamedSeriesRedirect(new URL(`${origin}/tv/Slash`), kv)).toBeNull();
    expect(await renamedSeriesRedirect(new URL(`${origin}/news/%E0%A4%A`), kv)).toBeNull();
  });
});
