import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { RESPONSE_INIT } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { EpisodeService } from "./episode.service";
import { GuidService } from "./guid.service";
import { episodeIdFromRouteQuery } from "./playable-route";
import { movedKindRedirect, movedSeriesHubPath, podcastEpisodeShortIdRedirect } from "./catalogue-links";
import { ODataService } from "./odata.service";
import { environment } from "./../environments/environment";
import { SearchResult } from "./search-result.interface";
import { isUnknownSearchFieldError, normalizePlayableHit, transferredSeriesHubFilter } from "./playable-search-hit";

/**
 * Old /podcast/ links for a moved Film, TV episode, news report, or transferred series leave before
 * the podcast page renders. A podcast episode opened by its full GUID moves to its short id once
 * (SSR 301, client replace); a lookup failure does not block that canonical move.
 */
export const redirectMovedKind: CanActivateFn = async (route, state) => {
  const guids = inject(GuidService);
  const episodes = inject(EpisodeService);
  const router = inject(Router);
  const oData = inject(ODataService);
  const responseInit = inject(RESPONSE_INIT, { optional: true });
  const query = route.paramMap.get("query") ?? "";
  const episodeId = episodeIdFromRouteQuery(guids, query);
  const name = route.paramMap.get("podcastName") ?? "";
  let target: string | null = null;
  try {
    target = episodeId
      ? await playableTarget(episodes, guids, state.url, episodeId, name)
      : await seriesTarget(oData, state.url, name);
  } catch {
    target = null;
  }
  target ??= episodeId ? withQueryString(podcastEpisodeShortIdRedirect(state.url, name, query), state.url) : null;
  if (!target) {
    return true;
  }
  if (responseInit) {
    responseInit.status = 301;
    const headers = new Headers(responseInit.headers);
    headers.set("Location", target);
    responseInit.headers = headers;
  }
  return router.parseUrl(target);
};

/** Keep `?…#…` from the old URL on the canonical podcast episode redirect. */
function withQueryString(target: string | null, currentUrl: string): string | null {
  if (!target) {
    return null;
  }
  const tail = currentUrl.search(/[?#]/);
  return tail < 0 ? target : target + currentUrl.slice(tail);
}

async function playableTarget(
  episodes: EpisodeService,
  guids: GuidService,
  currentPath: string,
  episodeId: string,
  name: string
): Promise<string | null> {
  const episode = await episodes.GetEpisodeDetailsFromApi(episodeId, name)
    ?? await episodes.getPlayableById(episodeId);
  return episode ? movedKindRedirect(currentPath, episode, guids) : null;
}

async function seriesTarget(
  oData: ODataService,
  currentPath: string,
  name: string
): Promise<string | null> {
  if (!name) {
    return null;
  }
  let hit: SearchResult | undefined;
  try {
    hit = await firstSeriesHit(oData, name, false);
  } catch (error) {
    if (!isUnknownSearchFieldError(error)) {
      throw error;
    }
    hit = await firstSeriesHit(oData, name, true);
  }
  if (!hit) {
    return null;
  }
  return movedSeriesHubPath(currentPath, name, normalizePlayableHit(hit).contentKind);
}

async function firstSeriesHit(
  oData: ODataService,
  name: string,
  legacyNames: boolean
): Promise<SearchResult | undefined> {
  const data = await firstValueFrom(oData.getEntities<SearchResult>(
    new URL("/search", environment.api).toString(),
    {
      search: "",
      filter: transferredSeriesHubFilter(name, legacyNames),
      searchMode: "any",
      queryType: "simple",
      count: true,
      skip: 0,
      top: 1,
      facets: [],
      orderby: "release desc",
    }
  ));
  return data.entities[0];
}
