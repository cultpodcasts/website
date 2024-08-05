import { FormControl } from "@angular/forms";


export interface PodcastForm {
    spotifyId: FormControl<string>;
    appleId: FormControl<number | null | undefined>;
    defaultSubject: FormControl<string | null | undefined>;
    releaseAuthority: FormControl<string>;
    primaryPostService: FormControl<string>;
    youTubePublicationDelay: FormControl<string>;
    twitterHandle: FormControl<string>;
    removed: FormControl<boolean>;
    indexAllEpisodes: FormControl<boolean>;
    bypassShortEpisodeChecking: FormControl<boolean>;
    skipEnrichingFromYouTube: FormControl<boolean>;
    titleRegex: FormControl<string>;
    descriptionRegex: FormControl<string>;
    episodeMatchRegex: FormControl<string>;
    episodeIncludeTitleRegex: FormControl<string>;
}