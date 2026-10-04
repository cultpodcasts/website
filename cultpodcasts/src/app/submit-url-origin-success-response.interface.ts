import { CataloguePlayableKind } from "./catalogue-playable-kind.enum";
import { SubmitEpisodeDetails } from "./submit-episode-details.interface";

export interface SubmitUrlOriginSuccessResponse {
    episode: string;
    episodeId?: string | undefined;
    podcast: string;
    podcastId?: string | undefined;
    contentKind?: CataloguePlayableKind | undefined;
    playableId?: string | undefined;
    episodeDetails?: SubmitEpisodeDetails;
}