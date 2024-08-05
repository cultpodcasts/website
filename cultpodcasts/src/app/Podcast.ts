
export interface Podcast {
    id?: string;
    removed: boolean;
    indexAllEpisodes: boolean;
    bypassShortEpisodeChecking: boolean;
    releaseAuthority: string;
    primaryPostService: string;
    spotifyId: string;
    appleId?: number|null;
    youTubePublicationDelay: string;
    skipEnrichingFromYouTube: boolean;
    twitterHandle: string;
    titleRegex: string;
    descriptionRegex: string;
    episodeMatchRegex: string;
    episodeIncludeTitleRegex: string;
    defaultSubject: string|null|undefined;
}