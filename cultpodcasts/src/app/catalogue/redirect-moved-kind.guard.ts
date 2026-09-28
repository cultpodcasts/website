import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { RESPONSE_INIT } from "@angular/core";
import { EpisodeService } from "../episode.service";
import { GuidService } from "../guid.service";
import { episodeIdFromRouteQuery } from "../playable-route";
import { movedKindRedirect } from "./catalogue-links";

/** Old /podcast/ links for a moved Film, TV episode, or news report leave before the podcast page renders. */
export const redirectMovedKind: CanActivateFn = async (route, state) => {
  const guids = inject(GuidService);
  const episodes = inject(EpisodeService);
  const router = inject(Router);
  const responseInit = inject(RESPONSE_INIT, { optional: true });
  const episodeId = episodeIdFromRouteQuery(guids, route.paramMap.get("query") ?? "");
  if (!episodeId) {
    return true;
  }
  const name = route.paramMap.get("podcastName") ?? "";
  try {
    const episode = await episodes.GetEpisodeDetailsFromApi(episodeId, name)
      ?? await episodes.getPlayableById(episodeId);
    const target = episode ? movedKindRedirect(state.url, episode, guids) : null;
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
