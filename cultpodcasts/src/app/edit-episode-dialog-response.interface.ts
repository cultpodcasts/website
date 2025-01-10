import { EpisodeChangeResponse } from "./episode-change-response.interface";

export interface EditEpisodeDialogResponse {
    closed?: boolean;
    noChange?: boolean;
    updated?: boolean;
    response?: EpisodeChangeResponse;
}
