import { YouTubeIndexingHints } from './youtube-indexing-hints.interface';

export interface Podcast {
    id?: string;
    name?: string;
    removed: boolean;
    indexAllEpisodes: boolean;
    bypassShortEpisodeChecking: boolean;
    alwaysPromoteAsHero?: boolean;
    releaseAuthority?: string;
    primaryPostService?: string;
    spotifyId: string;
    appleId?: number | null;
    youTubePublicationDelay: string;
    skipEnrichingFromYouTube: boolean;
    twitterHandle: string;
    blueskyHandle: string;
    titleRegex: string;
    descriptionRegex: string;
    episodeMatchRegex: string;
    episodeIncludeTitleRegex: string;
    defaultSubject: string | null | undefined;
    ignoreAllEpisodes: boolean;
    youTubeChannelId: string;
    youTubePlaylistId: string;
    /** Indexer-owned; read-only. Clear via PATCH `clearYouTubeIndexingHints`. */
    youTubeIndexingHints?: YouTubeIndexingHints | null;
    ignoredAssociatedSubjects?: string[];
    ignoredSubjects?: string[];
    lang?: string | null;
    knownTerms?: string[] | undefined;
    minimumDuration?: string | null;
    enrichmentHashTags?: string[] | null;
    hashTag?: string | null;
}