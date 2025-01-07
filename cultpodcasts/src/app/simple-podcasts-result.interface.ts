import { SimplePodcast } from "./simple-podcast.interface";

export interface SimplePodcastsResult {
    results: SimplePodcast[] | undefined;
    error: boolean;
    unauthorised: boolean;
}
