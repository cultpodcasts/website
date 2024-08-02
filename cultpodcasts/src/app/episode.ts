import { EpisodeUrls } from "./episode-urls";

export interface Episode {
    id: string,
    title: string,
    description: string,
    posted: boolean,
    tweeted: boolean,
    ignored: boolean,
    removed: boolean,
    release: Date,
    duration: string,
    explicit: boolean,
    spotifyId: string,
    appleId?: number,
    youTubeId: string,
    urls: EpisodeUrls,
    subjects: string[],
    searchTerms?: string
}
