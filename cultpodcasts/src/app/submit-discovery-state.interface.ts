export interface SubmitDiscoveryState {
    hasErrors: boolean;
    erroredItems: string[];
    allErrored: boolean;
    endpointError: boolean;
    episodeIds?: string[] | undefined;
    /** Set when a supervised submit was held for review (202). Nothing was applied. */
    heldSubmissionId?: string;
    /** Human-readable reason for endpointError (409 / 400 / …). */
    errorMessage?: string;
}
