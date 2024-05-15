import { ISimplePodcast } from "./ISimplePodcast";


export interface ISimplePodcastsResult {
    results: ISimplePodcast[] | undefined;
    error: boolean;
    unauthorised: boolean;
}
