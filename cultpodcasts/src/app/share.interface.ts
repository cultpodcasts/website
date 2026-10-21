import { ShareMode } from "./share-mode.enum";
import { SubmitParentTarget } from "./submit-parent-target.interface";

export interface Share {
  url: URL;
  podcastId: string | undefined;
  shareMode: ShareMode;
  podcastName: string | undefined;
  /** Hub submit: file under this news outlet / TV show. podcastId and podcastName are not sent. */
  parent?: SubmitParentTarget;
}