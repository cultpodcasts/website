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
  /** Leftover feed fields until R2 is republished with services/ids only. */
  spotify?: URL | string;
  apple?: URL | string;
  youtube?: URL | string;
  bbc?: URL | string;
  internetArchive?: URL | string;
  subjects: string[] | undefined;
  image: URL | undefined;
  /** Non-English IETF tag when present; omitted/undefined means English. */
  language?: string;
}
