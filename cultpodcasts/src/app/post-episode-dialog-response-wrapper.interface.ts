import { PostEpisodeDialogResponse } from "./post-episode-dialog-response.interface";

export interface PostEpisodeDialogResponseWrapper {
    postEpisodeDialogResponse: PostEpisodeDialogResponse;
    episodeId: string;
    /** Optional; Manual Tweet marks via guid-only GET + playable-aware markTweeted. */
    podcastId?: string;
}
