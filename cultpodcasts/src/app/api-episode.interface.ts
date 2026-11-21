import { EpisodeImageUrls } from "./episode-image-urls.interface";
import { EpisodeIds } from "./episode-ids.interface";
import { EpisodeUrls } from "./episode-urls.interface";
import { EpisodeServiceMap } from "./service-catalog";
import { Person } from "./person.interface";
import { PersonMatch } from "./person-match.interface";

/**
 * RPP #1484: an episode held for curator approval (today a split-off). Absent means approved, as on every ordinary
 * episode. Both values are hidden and never posted.
 */
export type ApprovalStatus = 'AwaitingApproval' | 'Rejected';

/** RPP #1484: a curator's decision on an episode held for approval. */
export type ApprovalDecision = 'Approve' | 'Reject';

export interface ApiEpisode {
    id: string;
    title: string;
    displayTitle?: string;
    podcastId?: string;
    podcastName?: string;
    /** Playable kind (Episode / TvShowEpisode / NewsReport / Film). Absent from older APIs = podcast episode. */
    contentKind?: string | null;
    /** Org / show guid for news and TV (absent for films). RPP #1063 / Api #179. */
    parentId?: string | null;
    /** Org / show name for news and TV (absent for films). */
    parentName?: string | null;
    /** Unencoded slug (film name for films). */
    slug?: string | null;
    /** Ready-made site path, e.g. `/news/{slug}/{shortId}`. */
    path?: string | null;
    description: string;
    displayDescription?: string;
    posted: boolean;
    tweeted: boolean;
    bluesky?: boolean | null;
    ignored: boolean;
    removed: boolean;
    /** RPP #1484: review state of an episode split off by a submit overwrite; absent on every other episode. */
    approvalStatus?: ApprovalStatus | null;
    explicit: boolean;
    release: Date;
    duration: string;
    ids?: EpisodeIds;
    spotifyId?: string;
    appleId?: number;
    youTubeId?: string;
    urls?: EpisodeUrls;
    images?: EpisodeImageUrls;
    services?: EpisodeServiceMap;
    subjects: string[];
    searchTerms?: string | null;
    hashTag?: string | null;
    youTubePodcast?: boolean;
    spotifyPodcast?: boolean;
    applePodcast?: boolean;
    releaseAuthority?: string;
    primaryPostService?: string;
    image?: URL;
    /** RPP #1500: a curator deliberately removed this episode's image; absent otherwise. */
    imageRemoved?: boolean;
    lang?: string | null;
    knownTerms?: string[] | undefined;
    guests?: string[] | undefined;
    guestPeople?: Person[] | undefined;
    guestSuggestions?: PersonMatch[] | undefined;
}