/**
 * Homepage rail order mixes pinned subjects with relative day slots.
 *
 * Day entries use `day:{offset}` where offset 0 is the newest day (n),
 * 1 is n−1, 2 is n−2, and so on. Absolute dates are never stored — slots
 * stay put as the calendar rolls.
 */

export const DAY_RAIL_PREFIX = 'day:';

const DAY_RAIL_RE = /^day:(\d+)$/;

export function dayRailEntry(offset: number): string {
  return `${DAY_RAIL_PREFIX}${offset}`;
}

export function parseDayRailOffset(entry: string): number | null {
  const match = DAY_RAIL_RE.exec(entry);
  if (!match) {
    return null;
  }
  return Number.parseInt(match[1], 10);
}

export function isDayRailEntry(entry: string): boolean {
  return parseDayRailOffset(entry) !== null;
}

/** UI / dialog label: n, n−1, n−2, … */
export function dayRailLabel(offset: number): string {
  return offset === 0 ? 'n' : `n−${offset}`;
}

export function subjectEntries(order: string[]): string[] {
  return order.filter((entry) => !isDayRailEntry(entry));
}

/**
 * Legacy default: newest day, then pinned subjects, then older days
 * (n−1, n−2, …).
 */
export function defaultRailOrder(dayCount: number, subjects: string[]): string[] {
  if (dayCount <= 0) {
    return [...subjects];
  }
  return [
    dayRailEntry(0),
    ...subjects,
    ...Array.from({ length: dayCount - 1 }, (_, i) => dayRailEntry(i + 1)),
  ];
}

/**
 * Resolve a saved order against the current week: drop ineligible subjects and
 * out-of-range day slots; inject any missing day slots. Subject-only legacy
 * lists get the default day interleave.
 */
export function normalizeRailOrder(
  saved: string[],
  dayCount: number,
  eligibleSubjects: ReadonlySet<string> | readonly string[]
): { order: string[]; changed: boolean } {
  const eligible =
    eligibleSubjects instanceof Set
      ? eligibleSubjects
      : new Set(eligibleSubjects);

  if (!saved.some(isDayRailEntry)) {
    const subjects: string[] = [];
    const seen = new Set<string>();
    for (const entry of saved) {
      if (isDayRailEntry(entry) || !eligible.has(entry) || seen.has(entry)) {
        continue;
      }
      seen.add(entry);
      subjects.push(entry);
    }
    const order = defaultRailOrder(dayCount, subjects);
    return {
      order,
      changed:
        order.length !== saved.length || order.some((entry, i) => entry !== saved[i]),
    };
  }

  const seenDays = new Set<number>();
  const seenSubjects = new Set<string>();
  const order: string[] = [];

  for (const entry of saved) {
    const offset = parseDayRailOffset(entry);
    if (offset !== null) {
      if (offset >= dayCount || seenDays.has(offset)) {
        continue;
      }
      seenDays.add(offset);
      order.push(dayRailEntry(offset));
      continue;
    }
    if (!eligible.has(entry) || seenSubjects.has(entry)) {
      continue;
    }
    seenSubjects.add(entry);
    order.push(entry);
  }

  for (let offset = 0; offset < dayCount; offset++) {
    if (!seenDays.has(offset)) {
      order.push(dayRailEntry(offset));
    }
  }

  return {
    order,
    changed:
      order.length !== saved.length || order.some((entry, i) => entry !== saved[i]),
  };
}

/**
 * Toggle a subject pin while preserving day-slot positions. New pins append
 * after the last entry.
 */
export function toggleSubjectInRailOrder(order: string[], subject: string): string[] {
  const idx = order.indexOf(subject);
  if (idx >= 0) {
    return order.filter((_, i) => i !== idx);
  }
  return [...order, subject];
}
