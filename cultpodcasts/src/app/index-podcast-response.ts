export interface IndexPodcastResponse {
    indexedEpisodes?: IndexedEpisode[];
}

export interface IndexedEpisode {
    episodeId: string;
    spotify: boolean;
    apple: boolean;
    youtube: boolean;
    subjects: string[];
}