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
    defaultLanguageFromDetection?: boolean;
    /**
     * RPP #1484: an overwrite moved the stored episode's old links to this new episode of the same podcast. It is
     * hidden (removed) until a curator reviews and approves it.
     */
    splitOffEpisodeId?: string | undefined;
}