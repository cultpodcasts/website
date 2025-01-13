import { EpisodePublishResponse } from "./episode-publish-response.interface";
import { PostEpisodeModel } from "./post-episode-model.interface";

export interface PostEpisodeDialogResponse {
    response?: EpisodePublishResponse,
    expectation?: PostEpisodeModel,
    noChange?: boolean
}
