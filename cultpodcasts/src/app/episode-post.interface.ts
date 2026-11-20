import { EpisodeImageUrls } from "./episode-image-urls.interface";
import { EpisodePostUrls } from "./episode-post-urls.interface";
import { EpisodeServiceMap } from "./service-catalog";
export interface EpisodePost {
    title?: string;
    description?: string;
    posted?: boolean;
    tweeted?: boolean;
    /** Same as tweeted: true marks Bluesky posted; false deletes when posted. */
    blueskyPosted?: boolean;
    /** Backward-compat alias for blueskyPosted: false. */
    unBluesky?: boolean;
    ignored?: boolean;
    removed?: boolean;
    /** RPP #1484: approve (public, then posted under the usual rules) or reject (stays hidden) a held split-off. */
    approvalDecision?: 'Approve' | 'Reject';
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