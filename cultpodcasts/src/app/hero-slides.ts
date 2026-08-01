import { HomepageEpisode } from './homepage-episode.interface';

/** Billboard pool size — curated list fills first, then autofill. */
export const HERO_POOL_SIZE = 15;

export const HERO_RECENT_CONTRIBUTION = 10;
export const HERO_SUBJECT_CONTRIBUTION = 6;
export const HERO_DISCOVER_CONTRIBUTION = 6;
/** Recency window to rotate through before capping contribution. */
export const HERO_RECENT_WINDOW = 48;

/** Approximate homepage week window for gating promote UI outside the homepage. */
export const HERO_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Whether a release falls in the rolling past week (with a small future slack).
 * Used to show the hero star on curator pages; the homepage still resolves
 * against actual `recentEpisodes`.
 */
export function isWithinHeroWeek(
  release: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  if (release == null) {
    return false;
  }
  const time = release instanceof Date ? release.getTime() : new Date(release).getTime();
  if (Number.isNaN(time)) {
    return false;
  }
  const nowMs = now.getTime();
  return time >= nowMs - HERO_WEEK_MS && time <= nowMs + 24 * 60 * 60 * 1000;
}

export interface HeroRailLike {
  episodes: HomepageEpisode[];
}

export interface HeroCultLike {
  episodes: HomepageEpisode[];
}

export interface HeroAutofillSources {
  subjectRails: HeroRailLike[];
  obscureCults: HeroCultLike[];
  /** Time bucket for stable rotation (e.g. floor(now / 3h)). */
  bucket: number;
}

/**
 * Resolve curated IDs against the current homepage episode set (this week's
 * recentEpisodes). Drops stale / unknown / out-of-week / duplicate IDs;
 * preserves curated order.
 */
export function resolveCuratedEpisodes(
  curatedIds: string[],
  allEpisodes: HomepageEpisode[]
): HomepageEpisode[] {
  if (curatedIds.length === 0 || allEpisodes.length === 0) {
    return [];
  }
  const byId = new Map(allEpisodes.map((ep) => [ep.id, ep]));
  const seen = new Set<string>();
  const resolved: HomepageEpisode[] = [];
  for (const id of curatedIds) {
    if (seen.has(id)) {
      continue;
    }
    const ep = byId.get(id);
    if (ep) {
      seen.add(id);
      resolved.push(ep);
    }
  }
  return resolved;
}

/**
 * Drop curated IDs that are no longer in the current week set.
 * Returns whether the list changed (caller should PUT when a curator is signed in).
 */
export function pruneCuratedIdsToWeek(
  curatedIds: string[],
  weekEpisodes: HomepageEpisode[]
): { ids: string[]; pruned: boolean } {
  const ids = resolveCuratedEpisodes(curatedIds, weekEpisodes).map((ep) => ep.id);
  const pruned =
    ids.length !== curatedIds.length || ids.some((id, i) => id !== curatedIds[i]);
  return { ids, pruned };
}

/**
 * Build the autofill pool using the week-wide recent / subject / discover interleave.
 * Used when curated picks alone are below HERO_POOL_SIZE.
 */
export function buildAutofillPool(
  allEpisodes: HomepageEpisode[],
  sources: HeroAutofillSources,
  poolSize: number = HERO_POOL_SIZE,
  excludeIds: ReadonlySet<string> = new Set()
): HomepageEpisode[] {
  if (allEpisodes.length === 0 || poolSize <= 0) {
    return [];
  }

  const bucket = sources.bucket;
  const byRecency = allEpisodes
    .slice()
    .sort((a, b) => (b.release as Date).getTime() - (a.release as Date).getTime());

  const recentWindow = byRecency.slice(0, HERO_RECENT_WINDOW);
  const recentSource = rotateTake(recentWindow, bucket * 3, HERO_RECENT_CONTRIBUTION);
  const subjectSource = sources.subjectRails
    .slice(0, HERO_SUBJECT_CONTRIBUTION)
    .map((rail, i) => pickAtOffset(rail.episodes, bucket + i));
  const discoverSource = sources.obscureCults
    .slice(0, HERO_DISCOVER_CONTRIBUTION)
    .map((cult, i) => pickAtOffset(cult.episodes, bucket + i + 1));

  const seen = new Set<string>(excludeIds);
  const pool: HomepageEpisode[] = [];
  const add = (ep: HomepageEpisode | undefined): void => {
    if (!ep || seen.has(ep.id) || pool.length >= poolSize) {
      return;
    }
    seen.add(ep.id);
    pool.push(ep);
  };

  const interleaved = [recentSource, subjectSource, discoverSource];
  for (
    let i = 0;
    pool.length < poolSize && interleaved.some((s) => i < s.length);
    i++
  ) {
    for (const source of interleaved) {
      if (i < source.length) {
        add(source[i]);
      }
    }
  }

  if (pool.length < poolSize) {
    for (const ep of rotateTake(recentWindow, bucket, recentWindow.length)) {
      if (pool.length >= poolSize) {
        break;
      }
      add(ep);
    }
  }
  if (pool.length < poolSize) {
    for (const ep of byRecency) {
      if (pool.length >= poolSize) {
        break;
      }
      add(ep);
    }
  }

  return pool;
}

/**
 * Hero slides: curated picks in order, then autofill up to poolSize when needed.
 * When curated alone is >= poolSize, returns exactly those curated episodes
 * (no autofill, no truncation).
 */
export function buildHeroSlides(
  curatedIds: string[],
  allEpisodes: HomepageEpisode[],
  sources: HeroAutofillSources,
  poolSize: number = HERO_POOL_SIZE
): HomepageEpisode[] {
  const curated = resolveCuratedEpisodes(curatedIds, allEpisodes);
  if (curated.length >= poolSize) {
    return curated;
  }
  if (allEpisodes.length === 0) {
    return curated;
  }
  const exclude = new Set(curated.map((ep) => ep.id));
  const autofill = buildAutofillPool(
    allEpisodes,
    sources,
    poolSize - curated.length,
    exclude
  );
  return [...curated, ...autofill];
}

export function rotateTake<T>(items: T[], offset: number, count: number): T[] {
  if (items.length === 0 || count <= 0) {
    return [];
  }
  const start = ((offset % items.length) + items.length) % items.length;
  const take = Math.min(count, items.length);
  const out: T[] = [];
  for (let i = 0; i < take; i++) {
    out.push(items[(start + i) % items.length]);
  }
  return out;
}

export function pickAtOffset<T>(items: T[], offset: number): T | undefined {
  if (items.length === 0) {
    return undefined;
  }
  return items[((offset % items.length) + items.length) % items.length];
}
