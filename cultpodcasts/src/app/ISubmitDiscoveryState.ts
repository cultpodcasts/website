export interface ISubmitDiscoveryState {
    hasErrors: boolean;
    erroredItems: string[];
    allErrored: boolean;
    endpointError: boolean;
    episodeIds?: string[] | undefined
}
