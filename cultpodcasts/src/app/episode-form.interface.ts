import { FormArray, FormControl, FormGroup } from "@angular/forms";

export interface AdditionalServiceForm {
    url: FormControl<string>,
    image: FormControl<string>,
}

export interface EpisodeForm {
    title: FormControl<string>,
    description: FormControl<string>,
    posted: FormControl<boolean>,
    tweeted: FormControl<boolean>,
    blueskyPosted: FormControl<boolean>,
    ignored: FormControl<boolean>,
    removed: FormControl<boolean>,
    explicit: FormControl<boolean>,
    release: FormControl<string>,
    duration: FormControl<string>,
    spotify: FormControl<URL | null | string>,
    spotifyImage: FormControl<URL | null | string>,
    apple: FormControl<URL | null | string>,
    appleImage: FormControl<URL | null | string>,
    youtube: FormControl<URL | null | string>,
    youtubeImage: FormControl<URL | null | string>,
    additionalUrls: FormArray<FormGroup<AdditionalServiceForm>>,
    subjects: FormControl<string[]>,
    searchTerms: FormControl<string | null>,
    hashTag: FormControl<string | null>,
    lang: FormControl<string | null>
    guests: FormControl<string[]>,
}
