export interface SubjectEntity {
    id?: string;
    aliases?: string[] | null;
    associatedSubjects?: string[] | null;
    name?: string;
    subjectType?: string | null;
    enrichmentHashTags?: string[] | null;
    hashTag?: string | null;
    redditFlairTemplateId?: string | null;
    redditFlareText?: string | null;
    knownTerms?: string[] | undefined;
}

/**
 * 202 create body the edit dialog can bind without GET /subject/:name.
 * `id` must be a non-empty string: an empty id is treated as missing, and the dialog would fall through to the name GET.
 */
export function subjectEntityWithId(body: unknown): (SubjectEntity & { id: string }) | undefined {
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
        return undefined;
    }
    const id = (body as { id?: unknown }).id;
    if (typeof id !== 'string' || id.length === 0) {
        return undefined;
    }
    return body as SubjectEntity & { id: string };
}
