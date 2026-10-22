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
  /**
   * `NewsReport`, `TvShowEpisode` or `Film`; absent (or `Episode`) for a podcast episode (RPP homepage
   * publisher). For the other kinds `podcastName` is the news outlet or TV show (a film's own name) and `id`
   * is the playable GUID: links go through cataloguePlayableLink / catalogueParentLink (short ids).
   */
  contentKind?: string | null;
}
