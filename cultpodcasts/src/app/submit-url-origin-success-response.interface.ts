import { SubmitEpisodeDetails } from "./submit-episode-details.interface";

export interface SubmitUrlOriginSuccessResponse {
    episode: string;
    episodeId?: string | undefined;
    podcast: string;
    episodeDetails?: SubmitEpisodeDetails;
}