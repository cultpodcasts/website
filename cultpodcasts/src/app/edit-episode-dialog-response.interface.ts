import { EpisodeChangeResponse } from "./episode-change-response.interface";

export interface EditEpisodeDialogResponse {
    closed?: boolean;
    noChange?: boolean;
    updated?: boolean;
    /** The episode became a Film; the dialog has already navigated to the film page. */
    movedToFilm?: boolean;
    response?: EpisodeChangeResponse;
    podcastId?: string;
}