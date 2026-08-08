import { EditPodcastPost } from "./edit-podcast-post.interface";

export interface AddPodcastPost extends EditPodcastPost {
    /** Podcast display name; API PodcastChangeRequest binds this as `name`. */
    name?: string;
}
