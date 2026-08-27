import { EpisodeIds } from "./episode-ids.interface";
import { EpisodeServiceMap } from "./service-catalog";

export interface HomepageEpisode {
  id: string;
  podcastName: string;
  episodeTitle: string;
  episodeDescription: string;
  release: Date;
  duration: string;
  ids?: EpisodeIds;
  svc?: string;
  services?: EpisodeServiceMap;
  subjects: string[] | undefined;
  image: URL | undefined;
  /** Non-English IETF tag when present; omitted/undefined means English. */
  language?: string;
}
