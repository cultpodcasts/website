import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { RESPONSE_INIT } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { EpisodeService } from "./episode.service";
import { GuidService } from "./guid.service";
import { episodeIdFromRouteQuery } from "./playable-route";
import { movedKindRedirect, movedSeriesHubPath } from "./catalogue-links";
import { ODataService } from "./odata.service";
import { environment } from "./../environments/environment";
import { SearchResult } from "./search-result.interface";
import { isUnknownSearchFieldError, normalizePlayableHit, transferredSeriesHubFilter } from "./playable-search-hit";

/** Old /podcast/ links for a moved Film, TV episode, news report, or transferred series leave before the podcast page renders. */
export const redirectMovedKind: CanActivateFn = async (route, state) => {
  const guids = inject(GuidService);
  const episodes = inject(EpisodeService);
  const router = inject(Router);
  const oData = inject(ODataService);
  const responseInit = inject(RESPONSE_INIT, { optional: true });
  const episodeId = episodeIdFromRouteQuery(guids, route.paramMap.get("query") ?? "");
  const name = route.paramMap.get("podcastName") ?? "";
  try {
    const target = episodeId
      ? await playableTarget(episodes, guids, state.url, episodeId, name)
      : await seriesTarget(oData, state.url, name);
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
  } catch {
    return true;
  }
};

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
