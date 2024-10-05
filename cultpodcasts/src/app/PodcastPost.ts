
export interface PodcastPost {
    removed?: boolean;
    indexAllEpisodes?: boolean;
    bypassShortEpisodeChecking?: boolean;
    releaseAuthority?: string;
    unsetReleaseAuthority?: boolean;
    primaryPostService?: string;
    unsetPrimaryPostService?: boolean;
    spotifyId?: string;
    appleId?: number | null;
    youTubePublicationDelay?: string;
    skipEnrichingFromYouTube?: boolean;
    twitterHandle?: string;
    titleRegex?: string;
    descriptionRegex?: string;
    episodeMatchRegex?: string;
    episodeIncludeTitleRegex?: string;
    defaultSubject?: string | null;
}
