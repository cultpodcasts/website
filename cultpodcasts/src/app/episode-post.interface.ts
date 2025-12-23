import { EpisodeImageUrls } from "./episode-image-urls.interface";
import { EpisodePostUrls } from "./episode-post-urls.interface";
export interface EpisodePost {
    title?: string;
    description?: string;
    posted?: boolean;
    tweeted?: boolean;
    bluesky?: boolean;
    ignored?: boolean;
    removed?: boolean;
    explicit?: boolean;
    release?: string;
    duration?: string;
    urls?: EpisodePostUrls;
    images?: EpisodeImageUrls;
    subjects?: string[];
    searchTerms?: string | null;
    lang?: string;
    twitterHandles?: string[];
    blueskyHandles?: string[];
}