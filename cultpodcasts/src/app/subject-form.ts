import { FormControl } from "@angular/forms";

export interface SubjectForm {
    name: FormControl<string>;
    aliases: FormControl<string[] | null | undefined>;
    associatedSubjects: FormControl<string[] | null | undefined>;
    subjectType: FormControl<string>;
    enrichmentHashTags: FormControl<string[] | null | undefined>;
    hashTag: FormControl<string | null | undefined>;
    redditFlairTemplateId: FormControl<string | null | undefined>;
    redditFlareText: FormControl<string | null | undefined>;
}
