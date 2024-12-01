import { EpisodeImageUrls } from "./episode-image-urls";
import { EpisodeUrls } from "./episode-urls";

export interface Episode {
    id: string,
    title: string,
    podcastName?: string,
    description: string,
    posted: boolean,
    tweeted: boolean,
    bluesky?: boolean | null,
    ignored: boolean,
    removed: boolean,
    explicit: boolean,
    release: Date,
    duration: string,
    urls: EpisodeUrls,
    images: EpisodeImageUrls,
    subjects: string[],
    searchTerms?: string | null,
    youTubePodcast?: boolean,
    spotifyPodcast?: boolean,
    applePodcast?: boolean,
    releaseAuthority?: string,
    primaryPostService?: string,
    image?: URL
}