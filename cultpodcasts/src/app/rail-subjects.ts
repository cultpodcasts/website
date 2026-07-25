import { HomepageEpisode } from './homepage-episode.interface';

/** A subject needs at least this many week episodes to earn a rail. */
export const SUBJECT_RAIL_MIN_EPISODES = 3;

/**
 * Max posters rendered per homepage rail. Candidates keep the full week list for
 * eligibility / manage-dialog counts; only the scroller DOM is capped — "Browse all"
 * covers the rest. Without this, a popular pin (100–200 eps) mounts that many cards.
 */
export const RAIL_DISPLAY_SIZE = 12;

export interface SubjectRailCandidate {
  subject: string;
  episodes: HomepageEpisode[];
}

/**
 * Group this week's episodes by subject (including meta topics such as
 * Cult Recovery), keeping subjects with enough episodes to fill a rail.
 * Internal `_`-prefixed tags are still skipped. Sorted by episode count desc,
 * then name.
 */
export function collectSubjectRailCandidates(
  allEpisodes: HomepageEpisode[],
  minEpisodes: number = SUBJECT_RAIL_MIN_EPISODES
): SubjectRailCandidate[] {
  const bySubject = new Map<string, HomepageEpisode[]>();
  for (const ep of allEpisodes) {
    for (const raw of ep.subjects ?? []) {
      if (!raw || raw.startsWith('_')) {
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
 * Build homepage subject rails from curator pins only — no popularity autofill.
 * Order follows the pinned list; unknown / ineligible pins are skipped.
 */
export function buildSubjectRails(
  pinnedSubjects: string[],
  candidates: SubjectRailCandidate[]
): SubjectRailCandidate[] {
  if (pinnedSubjects.length === 0 || candidates.length === 0) {
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

  return rails;
}
