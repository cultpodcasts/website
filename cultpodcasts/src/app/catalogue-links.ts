import { CatalogueParentKind } from "./catalogue-parent-kind.enum";
import { GuidService } from "./guid.service";
import { HomepageEpisode } from "./homepage-episode.interface";
import { SearchResult } from "./search-result.interface";

type CatalogueItem = HomepageEpisode | SearchResult;

const shortIds = new GuidService();
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when `id` is a canonical 8-4-4-4-12 GUID (any case). */
export function isGuid(id: string | null | undefined): id is string {
  return !!id && GUID.test(id);
}

/**
 * Film, TV, and news page ids use the kind-prefixed short id (the same one shares and the
 * moved-kind 301 use), so links land on the page's own URL with no redirect hop.
 * Anything that is not a GUID passes through unchanged.
 */
export function catalogueShortPageId(id: string, contentKind: "Film" | "TvShowEpisode" | "NewsReport"): string {
  return isGuid(id) ? shortIds.toCatalogueShortId(id, contentKind) : id;
}

export function filmPageCommands(title: string, id: string): string[] {
  return ["/film", title, catalogueShortPageId(id, "Film")];
}

export function tvShowEpisodePageCommands(show: string, id: string): string[] {
  return ["/tv", show, catalogueShortPageId(id, "TvShowEpisode")];
}

export function newsReportPageCommands(organisation: string, id: string): string[] {
  return ["/news", organisation, catalogueShortPageId(id, "NewsReport")];
}

/** Mixed lists choose a card with these paths. Podcast pages do not call this. */
export function cataloguePlayableLink(item: CatalogueItem): string[] {
  switch (item.contentKind) {
    case "Film":
      return filmPageCommands(item.episodeTitle, item.id);
    case "TvShowEpisode":
      return tvShowEpisodePageCommands(item.podcastName, item.id);
    case "NewsReport":
      return newsReportPageCommands(item.podcastName, item.id);
    default:
      return ["/podcast", item.podcastName, item.id];
  }
}

/**
 * Share link. Podcast episodes keep the s.cultpodcasts.com short link (its KV key is the
 * unprefixed 22-char id). Film, TV, and news link straight to their own page with the prefixed
 * short id: the shortener only accepts 22-char keys, so a prefixed short link there is a 404
 * (same choice as RPP's CataloguePlayableSiteLink for social posts).
 */
export function catalogueShareUrl(item: CatalogueItem, siteOrigin: string, shortner: string): string {
  if (item.contentKind === "Film" || item.contentKind === "TvShowEpisode" || item.contentKind === "NewsReport") {
    const [root, slug, id] = cataloguePlayableLink(item);
    return new URL(`${root}/${encodeURIComponent(slug)}/${id}`, siteOrigin).toString();
  }
  return `${shortner}/${shortIds.toBase64(item.id)}`;
}

/**
 * Route for a news report or TV episode from its kind, parent name and guid, with the short base-64 id
 * the site links use. Null for podcast episodes, films and a missing parent name or id.
 */
export function cataloguePlayableCommands(
  kind: string | null | undefined,
  parentName: string | null | undefined,
  playableId: string | null | undefined
): string[] | null {
  if (!parentName || !playableId) {
    return null;
  }
  switch (kind) {
    case "TvShowEpisode":
      return tvShowEpisodePageCommands(parentName, playableId);
    case "NewsReport":
      return newsReportPageCommands(parentName, playableId);
    default:
      return null;
  }
}

/**
 * Review page (/episodes/:ids) row title link. Uses the API's ready-made `path` when present (GET /episode/{id} for
 * every kind, RPP #1063 / Api #179); otherwise the podcast link `/podcast/{name}/{guid}`, or, for a row that has a
 * `contentKind` but no `path`, /news|/tv/{parent}/{short id} and /film/{title}/{short id}.
 */
export function reviewPlayableLink(
  episode: { id: string; title: string; podcastName?: string | null; contentKind?: string | null; path?: string | null; slug?: string | null; parentName?: string | null }
): string | string[] {
  if (episode.path?.startsWith("/")) {
    // Already site-encoded: as a string, routerLink parses it as a URL instead of encoding it again.
    return episode.path;
  }
  const parent = episode.parentName ?? episode.podcastName ?? "";
  switch (episode.contentKind) {
    case "Film":
      return filmPageCommands(episode.slug ?? episode.podcastName ?? episode.title, episode.id);
    case "TvShowEpisode":
      return tvShowEpisodePageCommands(parent, episode.id);
    case "NewsReport":
      return newsReportPageCommands(parent, episode.id);
    default:
      return ["/podcast", episode.podcastName ?? "", episode.id];
  }
}

/** Review page row parent link: the podcast, outlet or show hub. Null for films (no parent) or no name. */
export function reviewParentLink(
  episode: { podcastName?: string | null; parentName?: string | null; contentKind?: string | null }
): string[] | null {
  const name = episode.parentName ?? episode.podcastName;
  if (!name) {
    return null;
  }
  switch (episode.contentKind) {
    case "Film":
      return null;
    case "TvShowEpisode":
      return ["/tv", name];
    case "NewsReport":
      return ["/news", name];
    default:
      return ["/podcast", name];
  }
}

/** Film has no parent. TV and news hubs use the parent name. */
export function catalogueParentLink(item: CatalogueItem | undefined): string[] | null {
  if (!item) {
    return null;
  }
  switch (item.contentKind) {
    case "Film":
      return null;
    case "TvShowEpisode":
      return item.podcastName ? ["/tv", item.podcastName] : null;
    case "NewsReport":
      return item.podcastName ? ["/news", item.podcastName] : null;
    default:
      return item.podcastName ? ["/podcast", item.podcastName] : null;
  }
}

/** Public parent hubs after a podcast→TV/news transfer. Film is not a parent. */
export function catalogueParentHubCommands(
  kind: CatalogueParentKind | string | null | undefined,
  slug: string
): string[] | null {
  if (!slug) {
    return null;
  }
  switch (kind) {
    case CatalogueParentKind.TvShow:
      return ["/tv", slug];
    case CatalogueParentKind.NewsOrganisation:
      return ["/news", slug];
    default:
      return null;
  }
}

export function transferredPodcastKindSnackbarMessage(failureIndexingPlayables?: boolean): string {
  if (failureIndexingPlayables) {
    return "Podcast transferred. Some playables failed to reindex";
  }
  return "Podcast transferred";
}

type TransferredKindClose = {
  transferred?: boolean;
  targetKind?: CatalogueParentKind | string;
  response?: unknown;
};

/** Snackbar + slug-hub navigate for edit-podcast transfer close. Returns true when handled. */
export function applyTransferredPodcastKindClose(
  result: TransferredKindClose | null | undefined,
  slug: string,
  snackBar: { open: (message: string, action?: string, config?: { duration: number }) => unknown },
  router: { navigate: (commands: string[]) => unknown }
): boolean {
  if (!result?.transferred) {
    return false;
  }
  const commands = catalogueParentHubCommands(result.targetKind, slug);
  if (!commands) {
    snackBar.open("Podcast transferred but destination is unknown", "Ok", { duration: 10000 });
    return true;
  }
  const transferResponse = result.response as { failureIndexingPlayables?: boolean } | undefined;
  snackBar.open(
    transferredPodcastKindSnackbarMessage(transferResponse?.failureIndexingPlayables),
    "Ok",
    { duration: 10000 }
  );
  router.navigate(commands);
  return true;
}

/** Series /podcast/{name} after a TV or news transfer. Film has no parent hub. */
export function movedSeriesHubPath(
  currentPath: string,
  seriesName: string,
  contentKind?: string | null
): string | null {
  const root = contentKind === "TvShowEpisode" ? "tv" : contentKind === "NewsReport" ? "news" : null;
  if (!root || !seriesName) {
    return null;
  }
  const target = `/${root}/${encodeURIComponent(seriesName)}`;
  return samePath(currentPath, target) ? null : target;
}

/** Podcast page stays put. A guid stored as Film, TV, or News leaves for that path. */
export function movedKindRedirect(
  currentPath: string,
  episode: { id: string; contentKind?: string | null; episodeTitle: string; podcastName: string },
  guids: GuidService
): string | null {
  const slug = episode.contentKind === "Film" ? episode.episodeTitle : episode.podcastName;
  if (!slug) {
    return null;
  }
  const target = guids.movedPlayablePath(slug, episode.id, episode.contentKind);
  if (!target) {
    return null;
  }
  return samePath(currentPath, target) ? null : target;
}

/**
 * Router URLs leave `& @ : $ ,` unescaped while encodeURIComponent escapes them, and decodeURI
 * does not undo those escapes. Compare fully decoded segments so a slug such as "Law & Order"
 * is seen as already on its target and never loops through 301s.
 */
export function samePath(a: string, b: string): boolean {
  return normalisePath(a) === normalisePath(b);
}

function normalisePath(path: string): string {
  const bare = path.split("#")[0].split("?")[0].replace(/\/+$/, "");
  return bare.split("/").map(segment => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  }).join("/");
}
