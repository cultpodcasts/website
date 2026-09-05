import { IPageDetails } from './page-details.interface';
import { SearchResult } from './search-result.interface';
import {
  episodeArtAspect,
  episodeImageUrl,
  SearchDisplayEpisode
} from './search-result-links';

/** Share-image fields for og:image / twitter:image from the same art the episode hero uses. */
export function shareImageFieldsFromEpisode(
  episode: SearchDisplayEpisode
): Pick<IPageDetails, 'image' | 'imageAspect'> {
  const image = episodeImageUrl(episode)?.toString();
  if (!image) {
    return {};
  }
  return { image, imageAspect: episodeArtAspect(episode) };
}

/**
 * When page-details / shortener KV has no share art (common for streaming-only episodes),
 * fill image from search/homepage episode art so SSR og:image matches the hero.
 */
export function withEpisodeShareImage(
  pageDetails: IPageDetails,
  episode: SearchDisplayEpisode | undefined
): IPageDetails {
  if (pageDetails.image || !episode) {
    return pageDetails;
  }
  return { ...pageDetails, ...shareImageFieldsFromEpisode(episode) };
}

/** Client (and SSR fallback) page-details shape from a search hit. */
export function pageDetailsFromSearchEpisode(
  podcastName: string,
  episode: SearchResult
): IPageDetails {
  return {
    description: podcastName,
    title: `${episode.episodeTitle} | ${podcastName}`,
    releaseDate: episode.release.toString(),
    duration: episode.duration,
    ...shareImageFieldsFromEpisode(episode)
  };
}
