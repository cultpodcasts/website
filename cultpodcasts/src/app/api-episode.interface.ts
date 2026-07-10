import { EpisodeImageUrls } from "./episode-image-urls.interface";
import { EpisodeUrls } from "./episode-urls.interface";
import { Person } from "./person.interface";
import { PersonMatch } from "./person-match.interface";

export interface ApiEpisode {
    id: string;
    title: string;
    displayTitle?: string;
    podcastId?: string;
    podcastName?: string;
    description: string;
    displayDescription?: string;
    posted: boolean;
    tweeted: boolean;
    bluesky?: boolean | null;
    ignored: boolean;
    removed: boolean;
    explicit: boolean;
    release: Date;
    duration: string;
    urls: EpisodeUrls;
    images?: EpisodeImageUrls;
    subjects: string[];
    searchTerms?: string | null;
    youTubePodcast?: boolean;
    spotifyPodcast?: boolean;
    applePodcast?: boolean;
    releaseAuthority?: string;
    primaryPostService?: string;
    image?: URL;
    lang?: string | null;
    knownTerms?: string[] | undefined;
    guests?: string[] | undefined;
    guestPeople?: Person[] | undefined;
    guestSuggestions?: PersonMatch[] | undefined;
}