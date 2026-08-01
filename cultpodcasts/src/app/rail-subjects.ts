import { HomepageEpisode } from './homepage-episode.interface';
import { isDayRailEntry, normalizeRailOrder, subjectEntries } from './rail-order';

/** A subject needs at least this many week episodes to earn a rail. */
export const SUBJECT_RAIL_MIN_EPISODES = 3;

/**
 * Max posters rendered per homepage *subject* rail. Candidates keep the full week
 * list for eligibility / manage-dialog counts; the scroller is capped and "Browse all"
 * links to `/subject/:name`. Day rails are not capped — they have no show-more destination
 * and are already bounded by progressive load.
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
 * Drop pinned subjects (and out-of-range day slots) that no longer belong
 * this week. Day slots use relative offsets (n, n−1, …). Returns whether the
 * list changed (local display prune — server cron owns Durable Object writes).
 */
export function pruneRailSubjectsToWeek(
  railOrder: string[],
  candidates: SubjectRailCandidate[],
  dayCount: number = 0
): { subjects: string[]; pruned: boolean } {
  const eligible = new Set(candidates.map((c) => c.subject));
  if (railOrder.some(isDayRailEntry) || dayCount > 0) {
    const { order, changed } = normalizeRailOrder(railOrder, dayCount, eligible);
    return { subjects: order, pruned: changed };
  }

  const seen = new Set<string>();
  const subjects: string[] = [];
  for (const subject of subjectEntries(railOrder)) {
    if (!eligible.has(subject) || seen.has(subject)) {
      continue;
    }
    seen.add(subject);
    subjects.push(subject);
  }
  const pruned =
    subjects.length !== railOrder.length ||
    subjects.some((subject, i) => subject !== railOrder[i]);
  return { subjects, pruned };
}

/**
 * Build homepage subject rails from curator pins only — no popularity autofill.
 * Order follows the pinned list; day slots and unknown / ineligible pins are skipped.
 */
export function buildSubjectRails(
  railOrder: string[],
  candidates: SubjectRailCandidate[]
): SubjectRailCandidate[] {
  const pinnedSubjects = subjectEntries(railOrder);
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
