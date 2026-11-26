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
    /**
     * Additional YouTube uploads to keep, in display order (RPP #1526). Existing entries are identified by
     * `youTubeId`; a new entry is added from a YouTube `url`. Omitted entries are removed; `[]` removes all.
     */
    additionalYouTube?: { youTubeId?: string; url?: string; title?: string; channelName?: string }[];
    /** Additional YouTube ids this editor last saw. Sent with `additionalYouTube`. */
    expectedAdditionalYouTubeIds?: string[];
    /** Swap this additional YouTube id into the primary YouTube link. */
    promoteYouTubeId?: string;
}