import { EpisodeImageUrls } from "./episode-image-urls.interface";
import { EpisodePostUrls } from "./episode-post-urls.interface";
import { EpisodeServiceMap } from "./service-catalog";
export interface EpisodePost {
    title?: string;
    description?: string;
    posted?: boolean;
    tweeted?: boolean;
    /** When true, clear Bluesky post state and delete the remote post. */
    unBluesky?: boolean;
    ignored?: boolean;
    removed?: boolean;
    explicit?: boolean;
    release?: string;
    duration?: string;
    urls?: EpisodePostUrls;
    images?: EpisodeImageUrls;
    services?: EpisodeServiceMap;
    subjects?: string[];
    searchTerms?: string | null;
    hashTag?: string | null;
    lang?: string;
    guests?: string[];
}