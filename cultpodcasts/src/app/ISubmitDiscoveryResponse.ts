export interface SubmitDiscoveryResponse {
    message: string;
    errorsOccurred: boolean;
    results: SubmitDiscoveryItemResult[];
}

export interface SubmitDiscoveryItemResult {
    discoveryItemId: string;
    message: string;
    episodeId: string | undefined
}
