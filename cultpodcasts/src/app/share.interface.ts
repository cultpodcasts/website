import { ShareMode } from "./share-mode.enum";

export interface Share {
  url: URL;
  podcastId: string | undefined;
  shareMode: ShareMode;
  podcastName: string | undefined;
}