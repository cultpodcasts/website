import { SubjectMatch } from './subject-match.interface';

const sourceLabels: Record<SubjectMatch['source'], string> = {
    Title: 'title',
    Description: 'description',
    PodcastDefault: 'podcast default'
};

function describe(match: SubjectMatch): string {
    return match.source === 'PodcastDefault' || !match.term
        ? 'podcast default subject'
        : `matched "${match.term}" in ${sourceLabels[match.source] ?? match.source.toLowerCase()}`;
}

/**
 * Builds a per-subject explanation from subject matches, e.g.
 * `matched "cult" in title; matched "sect" in description`.
 * Returns null when there are no matches (null = not recorded, [] = no evidence),
 * so callers fall back to plain chips.
 */
export function subjectMatchReasons(
    matches: SubjectMatch[] | null | undefined
): Record<string, string> | null {
    if (!matches?.length) {
        return null;
    }
    const grouped = new Map<string, string[]>();
    for (const match of matches) {
        const reasons = grouped.get(match.subject) ?? [];
        const reason = describe(match);
        if (!reasons.includes(reason)) {
            reasons.push(reason);
        }
        grouped.set(match.subject, reasons);
    }
    return Object.fromEntries([...grouped].map(([subject, reasons]) => [subject, reasons.join('; ')]));
}
