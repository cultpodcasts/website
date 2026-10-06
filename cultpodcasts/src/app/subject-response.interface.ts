/**
 * `Api.Dtos.SubjectDto`.
 * PUT /subject returns this body with 202. GET /subject/{name} returns it with 200.
 * Guid properties are JSON strings. `subjectType` is the `SubjectType` enum name from `JsonStringEnumConverter`.
 */
export interface SubjectResponse {
    id: string | null;
    aliases: string[] | null;
    associatedSubjects: string[] | null;
    name: string | null;
    enrichmentHashTags: string[] | null;
    hashTag: string | null;
    redditFlairTemplateId: string | null;
    redditFlareText: string | null;
    subjectType: "Unset" | "Canonical" | "Meta" | null;
    knownTerms: string[] | null;
}

/** A 202 body the edit dialog can bind. `id` is Guid? on the DTO, so a missing or empty id is not a created subject. */
export function subjectResponseWithId(body: SubjectResponse | null): (SubjectResponse & { id: string }) | undefined {
    if (body == null || body.id == null || body.id.length === 0) {
        return undefined;
    }
    return { ...body, id: body.id };
}
