import { EpisodePublishResponse } from "./episode-publish-response.interface";
import { PostEpisodeModel } from "./post-episode-model.interface";

export interface PostEpisodeDialogResponseInterface {
    response?: EpisodePublishResponse,
    expectation?: PostEpisodeModel,
    noChange?: boolean
}
