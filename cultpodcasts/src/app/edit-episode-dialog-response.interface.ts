import type { EpisodeUpdateResponse } from '@cultpodcasts/contracts';

export interface EditEpisodeDialogResponse {
    closed?: boolean;
    noChange?: boolean;
    updated?: boolean;
    /** The episode became a Film; the dialog has already navigated to the film page. */
    movedToFilm?: boolean;
    /** The episode became a film trailer (episode row deleted); the dialog has navigated to the film page. */
    attachedAsTrailer?: boolean;
    /** The episode became a TV show episode (episode row deleted); the dialog has navigated to the TV episode page. */
    movedToTvShow?: boolean;
    response?: EpisodeUpdateResponse;
    podcastId?: string;
}