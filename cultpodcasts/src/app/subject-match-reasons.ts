import { SubjectMatch } from './subject-match.interface';

const sourceLabels: Record<SubjectMatch['source'], string> = {
    Title: 'title',
    Description: 'description',
    PodcastDefault: 'podcast default'
};

function describe(match: SubjectMatch): string {
    if (match.source === 'PodcastDefault') {
        return 'podcast default subject';
    }
    const field = Object.hasOwn(sourceLabels, match.source)
        ? sourceLabels[match.source]
        : String(match.source).toLowerCase();
    return match.term ? `matched "${match.term}" in ${field}` : `matched in ${field}`;
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
    // Null prototype: subjects are free text, so names like "constructor" must not hit Object.prototype.
    const result: Record<string, string> = Object.create(null);
    for (const [subject, reasons] of grouped) {
        result[subject] = reasons.join('; ');
    }
    return result;
}
