export interface EpisodePublishResponse {
    posted?: boolean;
    tweeted?: boolean;
    blueskyPosted?: boolean;
    failedTweetContent?: string;
    /** Why nothing was published, on a refused 400 (e.g. awaiting approval, RPP #1484). */
    message?: string;
    podcastId: string;
}
