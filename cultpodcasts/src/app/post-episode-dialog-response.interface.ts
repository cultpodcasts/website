import { EpisodePublishResponse } from "./episode-publish-response.interface";
import { PostEpisodeModel } from "./post-episode-model.interface";

export interface PostEpisodeDialogResponse {
    response?: EpisodePublishResponse,
    expectation?: PostEpisodeModel,
    noChange?: boolean,
    /** User dismissed without posting (Close). Callers should treat as no-op. */
    closed?: boolean,
    /** From GET /episode/{id}; drives publish snackbar noun (Film / News Report / TV Episode). */
    contentKind?: string | null,
}
