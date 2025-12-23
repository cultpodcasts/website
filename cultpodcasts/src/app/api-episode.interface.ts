import { EpisodeImageUrls } from "./episode-image-urls.interface";
import { EpisodeUrls } from "./episode-urls.interface";

export interface ApiEpisode {
    id: string;
    title: string;
    podcastName?: string;
    description: string;
    posted: boolean;
    tweeted: boolean;
    bluesky?: boolean | null;
    ignored: boolean;
    removed: boolean;
    explicit: boolean;
    release: Date;
    duration: string;
    urls: EpisodeUrls;
    images?: EpisodeImageUrls;
    subjects: string[];
    searchTerms?: string | null;
    youTubePodcast?: boolean;
    spotifyPodcast?: boolean;
    applePodcast?: boolean;
    releaseAuthority?: string;
    primaryPostService?: string;
    image?: URL;
    lang?: string | null;
    knownTerms?: string[] | undefined;
    twitterHandles?: string[] | undefined;
    blueskyHandles?: string[] | undefined;
}