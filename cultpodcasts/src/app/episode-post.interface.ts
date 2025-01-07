import { EpisodeImageUrls } from "./episode-image-urls.interface";
import { EpisodeUrls } from "./episode-urls.interface";

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
    urls?: EpisodeUrls;
    images?: EpisodeImageUrls;
    subjects?: string[];
    searchTerms?: string | null;
}
