
export interface IDiscoveryResults {
    ids: string[];
    results: IDiscoveryResult[]
}

export interface IDiscoveryResult {
    id: string;
    urls: IDiscoveryResultUrls;
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

export interface IDiscoveryResultUrls {
    spotify: URL | undefined;
    youtube: URL | undefined;
    apple: URL | undefined;
}

