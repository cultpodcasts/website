import { ShareMode } from "./ShareMode";

export interface IShare {
  url: URL;
  podcastId: string | undefined;
  shareMode: ShareMode;
}