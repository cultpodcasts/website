export interface SubmitDiscoveryItemResult {
    discoveryItemId: string;
    message: string;
    episodeId: string | undefined;
    podcastId: string | undefined;
    /** Why the item failed (exception type and message). null on success. */
    error?: string | null;
}
