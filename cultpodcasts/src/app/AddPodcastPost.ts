import { EditPodcastPost } from "./EditPodcastPost";

export interface AddPodcastPost extends EditPodcastPost {
    podcastName?: string;
}
