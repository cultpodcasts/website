import { DiscoveryResultUrls } from "./discovery-result-urls.interface";
import { SubjectMatch } from "./subject-match.interface";

export interface DiscoveryResult {
    id: string;
    urls: DiscoveryResultUrls;
    episodeName: string | undefined;
    showName: string | undefined;
    episodeDescription: string | undefined;
    showDescription: string | undefined;
    released: Date;
    duration: string | undefined;
    subjects: string[];
    /** Why each subject matched. null = not recorded (older results); [] = recorded, no evidence. */
    subjectMatches?: SubjectMatch[] | null;
    youTubeViews: number | undefined;
    youTubeChannelMembers: number | undefined;
    containsSyntheticMedia: boolean | null | undefined;
    guests: string[] | undefined;
    imageUrl: URL | undefined;
    enrichedTimeFromApple: boolean;
    enrichedUrlFromSpotify: boolean;
    youTubeChannelId?: string | null;
    spotifyId?: string | null;
    appleId?: number | null;
    matchingPodcasts: DiscoveryPodcast[] | null;
    acceptProbability: number | null;
    autoHidden: boolean;
    isFocused: boolean | undefined;
}

export interface DiscoveryPodcast {
    id?: string;
    name: string;
    visible: boolean;
    visibleEpisodes: number;
    kind?: string | null;
}