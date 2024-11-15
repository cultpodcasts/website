import { SubmitEpisodeDetails } from "./SubmitEpisodeDetails";

export interface SubmitUrlOriginSuccessResponse {
    episode: string;
    episodeId?: string | undefined;
    podcast: string;
    episodeDetails?: SubmitEpisodeDetails;
}