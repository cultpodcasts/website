import { HomepageEpisode } from './homepage-episode.interface';
import { isMetaSubject } from './obscure-cults';

/** How many subject rails the homepage shows between day rails. */
export const SUBJECT_RAIL_COUNT = 6;
/** A subject needs at least this many week episodes to earn a rail. */
export const SUBJECT_RAIL_MIN_EPISODES = 3;

export interface SubjectRailCandidate {
  subject: string;
  episodes: HomepageEpisode[];
}

/**
 * Group this week's episodes by non-meta subject, keeping subjects with enough
 * episodes to fill a rail. Sorted by episode count desc, then name.
 */
export function collectSubjectRailCandidates(
  allEpisodes: HomepageEpisode[],
  minEpisodes: number = SUBJECT_RAIL_MIN_EPISODES
): SubjectRailCandidate[] {
  const bySubject = new Map<string, HomepageEpisode[]>();
  for (const ep of allEpisodes) {
    for (const raw of ep.subjects ?? []) {
      if (!raw || raw.startsWith('_') || isMetaSubject(raw)) {
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

  return [...bySubject.entries()]
    .filter(([, eps]) => eps.length >= minEpisodes)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([subject, episodes]) => ({
      subject,
      episodes: episodes
        .slice()
        .sort((a, b) => (b.release as Date).getTime() - (a.release as Date).getTime()),
    }));
}

/**
 * Drop pinned subjects that no longer qualify for a rail this week.
 * Returns whether the list changed (caller should PUT when a curator is signed in).
 */
export function pruneRailSubjectsToWeek(
  pinnedSubjects: string[],
  candidates: SubjectRailCandidate[]
): { subjects: string[]; pruned: boolean } {
  const eligible = new Set(candidates.map((c) => c.subject));
  const seen = new Set<string>();
  const subjects: string[] = [];
  for (const subject of pinnedSubjects) {
    if (!eligible.has(subject) || seen.has(subject)) {
      continue;
    }
    seen.add(subject);
    subjects.push(subject);
  }
  const pruned =
    subjects.length !== pinnedSubjects.length ||
    subjects.some((subject, i) => subject !== pinnedSubjects[i]);
  return { subjects, pruned };
}

/**
 * Build homepage subject rails: every pinned subject in curator order (like
 * curated heroes, pinning `railCount` or more gives full control and disables
 * autofill), then autofill from the popularity-sorted candidates up to
 * `railCount` when pins alone fall short.
 */
export function buildSubjectRails(
  pinnedSubjects: string[],
  candidates: SubjectRailCandidate[],
  railCount: number = SUBJECT_RAIL_COUNT
): SubjectRailCandidate[] {
  if (candidates.length === 0 || railCount <= 0) {
    return [];
  }

  const bySubject = new Map(candidates.map((c) => [c.subject, c]));
  const used = new Set<string>();
  const rails: SubjectRailCandidate[] = [];

  for (const subject of pinnedSubjects) {
    const candidate = bySubject.get(subject);
    if (!candidate || used.has(subject)) {
      continue;
    }
    used.add(subject);
    rails.push(candidate);
  }

  for (const candidate of candidates) {
    if (rails.length >= railCount) {
      break;
    }
    if (used.has(candidate.subject)) {
      continue;
    }
    used.add(candidate.subject);
    rails.push(candidate);
  }

  return rails;
}
