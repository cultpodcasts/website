export interface EditPodcastPost {
    removed?: boolean;
    indexAllEpisodes?: boolean;
    bypassShortEpisodeChecking?: boolean;
    releaseAuthority?: string;
    unsetReleaseAuthority?: boolean;
    primaryPostService?: string;
    unsetPrimaryPostService?: boolean;
    spotifyId?: string;
    appleId?: number | null;
    nullAppleId?: boolean;
    youTubePublicationDelay?: string;
    skipEnrichingFromYouTube?: boolean;
    twitterHandle?: string;
    blueskyHandle?: string;
    titleRegex?: string;
    descriptionRegex?: string;
    episodeMatchRegex?: string;
    episodeIncludeTitleRegex?: string;
    defaultSubject?: string | null;
    ignoreAllEpisodes?: boolean;
    youTubePlaylistId?: string;
    ignoredAssociatedSubjects?: string[];
    ignoredSubjects?: string[];
}
