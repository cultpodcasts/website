import { EpisodeUrls } from "./episode-urls";

export interface Episode {
    id: string,
    title: string,
    podcastName?: string,
    description: string,
    posted: boolean,
    tweeted: boolean,
    ignored: boolean,
    removed: boolean,
    explicit: boolean,
    release: Date,
    duration: string,
    urls: EpisodeUrls,
    subjects: string[],
    searchTerms?: string | null
}