export interface SubjectEntity {
    id?: string;
    aliases?: string[] | null;
    associatedSubjects?: string[] | null;
    name?: string;
    subjectType?: string | null;

    enrichmentHashTags?: string[] | null;
    hashTag?: string | null;

    redditFlairTemplateId?: string | null;
    redditFlairText?: string | null;
}
