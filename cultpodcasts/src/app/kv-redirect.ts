/** The `redirects` KV binding, narrowed to what the redirect lookup needs. */
export interface RedirectLookup {
  get(key: string): Promise<string | null>;
}

const podcastPrefix = "/podcast/";
/** Exact hub paths only: /news/{name} or /tv/{name}, optional trailing slash. Not /{hub}/{name}/{id}, not /film/. */
const hubPath = /^\/(news|tv)\/([^/]+)\/?$/;

/**
 * 301 target for a renamed series, or null.
 * - /podcast/{old}[/…] uses KV key `{old}` and keeps the rest of the path (unchanged behaviour).
 * - /news/{old} and /tv/{old} use KV keys `news/{old}` and `tv/{old}`, written by the admin rename (RPP #1053).
 */
export async function renamedSeriesRedirect(url: URL, redirects: RedirectLookup): Promise<URL | null> {
  if (url.pathname.startsWith(podcastPrefix)) {
    const podcast = url.pathname.split("/")[2];
    let podcastName: string;
    try {
      podcastName = decodeURIComponent(podcast);
    } catch {
      return null;
    }
    const newPodcastName = await redirects.get(podcastName);
    if (!newPodcastName) {
      return null;
    }
    const targetPath = podcastPrefix + newPodcastName + url.pathname.substring(podcast.length + podcastPrefix.length);
    return new URL(targetPath, new URL("/", url));
  }

  const hub = hubPath.exec(url.pathname);
  if (!hub) {
    return null;
  }
  const [, kind, encodedName] = hub;
  let name: string;
  try {
    name = decodeURIComponent(encodedName);
  } catch {
    return null;
  }
  if (!name.trim()) {
    return null;
  }
  const newName = await redirects.get(`${kind}/${name}`);
  if (!newName || newName === name || newName.includes("/")) {
    return null;
  }
  const target = new URL(`/${kind}/${encodeURIComponent(newName)}`, new URL("/", url));
  target.search = url.search;
  return target;
}
