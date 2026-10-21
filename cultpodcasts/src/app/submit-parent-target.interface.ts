import { CatalogueParentKind } from "./catalogue-parent-kind.enum";

/**
 * "Submit URL for this news outlet / TV show". Sent on POST /submit instead of podcastId/podcastName,
 * so Azure files the URL under that parent (NewsReport / TvShowEpisode) and never creates a podcast.
 */
export interface SubmitParentTarget {
  parentKind: CatalogueParentKind.NewsOrganisation | CatalogueParentKind.TvShow;
  parentId: string;
  parentName: string;
}
