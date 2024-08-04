import { FormControl } from "@angular/forms";

export interface EpisodeForm {
    title: FormControl<string>,
    description: FormControl<string>,
    posted: FormControl<boolean>,
    tweeted: FormControl<boolean>,
    ignored: FormControl<boolean>,
    removed: FormControl<boolean>,
    explicit: FormControl<boolean>,
    release: FormControl<string>,
    duration: FormControl<string>,
    spotify: FormControl<URL|null>,
    apple: FormControl<URL|null>,
    youtube: FormControl<URL|null>,
    subjects: FormControl<string[]>,
    searchTerms: FormControl<string|null>,
}
