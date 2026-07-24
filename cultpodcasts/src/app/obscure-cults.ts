import { HomepageEpisode } from './homepage-episode.interface';

export interface ObscureCult {
  subject: string;
  episodes: HomepageEpisode[];
  /** Cover art from the newest episode in the set. */
  imageUrl?: string;
}

/** Topic / meta tags — not named groups to “discover”. */
const META_SUBJECTS = new Set(
  [
    'Cult Psychology',
    'Cult Recovery',
    'Cult-Expert',
    'Psychology',
    'Political Cult',
    'Human Trafficking',
    'Multi-Level Marketing',
    'Evangelicalism',
    'Self-Help',
    'Legislation',
    'One-on-one',
    'Purity Culture',
    'Dissociative Identity Disorder',
    'Troubled Teen Industry',
    'Hustler\'s University',
  ].map((s) => s.toLowerCase())
);

/** Household-name groups — leave these to the main rails. */
const WELL_KNOWN = new Set(
  [
    'Scientology',
    'Jehovah\'s Witnesses',
    'The Church Of Jesus Christ Of Latter-Day Saints',
    'FLDS Church',
    'Manson Family',
    'Peoples Temple',
    'Branch Davidians',
    'Heaven\'s Gate',
    'NXIVM',
    'Children Of God',
    'Amish',
    'Southern Baptist Convention',
    'Church Of England',
    'Hare Krishnas',
    'Unification Church',
    'Aum Shinrikyo',
  ].map((s) => s.toLowerCase())
);

export function isMetaSubject(subject: string): boolean {
  return META_SUBJECTS.has(subject.trim().toLowerCase());
}

export function isWellKnownCult(subject: string): boolean {
  return WELL_KNOWN.has(subject.trim().toLowerCase());
}

/**
 * Long-tail named groups from this week's homepage episodes.
 * Prefers 1–4 episode subjects, excludes meta tags and household names.
 * Selection is stable within a calendar week.
 */
export function pickObscureCults(
  episodes: HomepageEpisode[],
  imageFor: (episode: HomepageEpisode) => string | undefined,
  options: { limit?: number; maxEpisodes?: number; now?: Date } = {}
): ObscureCult[] {
  const limit = options.limit ?? 12;
  const maxEpisodes = options.maxEpisodes ?? 4;
  const now = options.now ?? new Date();

  const bySubject = new Map<string, HomepageEpisode[]>();
  for (const ep of episodes) {
    for (const raw of ep.subjects ?? []) {
      if (!raw || raw.startsWith('_') || isMetaSubject(raw) || isWellKnownCult(raw)) {
        continue;
      }
      const list = bySubject.get(raw);
      if (list) {
        if (!list.some((e) => e.id === ep.id)) {
          list.push(ep);
        }
      } else {
        bySubject.set(raw, [ep]);
      }
    }
  }

  const weekKey = isoWeekKey(now);
  const candidates = [...bySubject.entries()]
    .filter(([, eps]) => eps.length >= 1 && eps.length <= maxEpisodes)
    .map(([subject, eps]) => {
      const sorted = eps
        .slice()
        .sort((a, b) => (b.release as Date).getTime() - (a.release as Date).getTime());
      return {
        subject,
        episodes: sorted,
        imageUrl: imageFor(sorted[0]),
        rank: hashString(`${weekKey}|${subject}`),
      };
    })
    .sort((a, b) => a.rank - b.rank || a.subject.localeCompare(b.subject));

  return candidates.slice(0, limit).map(({ subject, episodes, imageUrl }) => ({
    subject,
    episodes,
    imageUrl,
  }));
}

function isoWeekKey(date: Date): string {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${week}`;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
