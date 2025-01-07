import { DiscoveryResultUrls } from "./discovery-result-urls.interface";

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
    youTubeViews: number | undefined;
    youTubeChannelMembers: number | undefined;
    imageUrl: URL | undefined;
    enrichedTimeFromApple: boolean;
    enrichedUrlFromSpotify: boolean;
    matchingPodcasts: string[];
    isFocused: boolean | undefined;
}
