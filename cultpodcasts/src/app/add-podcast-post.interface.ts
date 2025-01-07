import { EditPodcastPost } from "./edit-podcast-post.interface";

export interface AddPodcastPost extends EditPodcastPost {
    podcastName?: string;
}
