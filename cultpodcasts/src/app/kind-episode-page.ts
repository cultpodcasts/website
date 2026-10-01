import { afterNextRender, inject, Injector, PLATFORM_ID, signal, Signal } from "@angular/core";
import { isPlatformServer } from "@angular/common";
import { RESPONSE_INIT } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { DestroyRef } from "@angular/core";
import { GuidService } from "./guid.service";
import { SeoService } from "./seo.service";
import { EpisodeService } from "./episode.service";
import { SearchResult } from "./search-result.interface";
import { IPageDetails } from "./page-details.interface";
import { pageDetailsFromSearchEpisode, withEpisodeShareImage } from "./episode-seo";
import { displayCatalogName } from "./display-catalog-name";
import { episodeIdFromRouteQuery } from "./playable-route";
import { movedKindRedirect } from "./catalogue-links";

export interface KindEpisodePageState {
  slug: Signal<string>;
  episode: Signal<SearchResult | undefined>;
  isLoading: Signal<boolean>;
  isEpisode: Signal<boolean>;
  showEpisodeSkeleton: Signal<boolean>;
  parentHub: Signal<string[] | null>;
  displayCatalogName: typeof displayCatalogName;
  start(): void;
}

export function connectKindEpisode(options: {
  parentHub: (slug: string) => string[] | null;
  seoName: (episode: SearchResult, slug: string) => string;
  contentKind?: string;
}): KindEpisodePageState {
  const route = inject(ActivatedRoute);
  const router = inject(Router);
  const destroyRef = inject(DestroyRef);
  const guids = inject(GuidService);
  const seo = inject(SeoService);
  const episodes = inject(EpisodeService);
  const responseInit = inject(RESPONSE_INIT, { optional: true });
  const platformId = inject(PLATFORM_ID);
  const injector = inject(Injector);
  const isServer = isPlatformServer(platformId);

  const slug = signal("");
  const episode = signal<SearchResult | undefined>(undefined);
  const isLoading = signal(true);
  const isEpisode = signal(false);
  const showEpisodeSkeleton = signal(false);
  const parentHub = signal<string[] | null>(null);

  if (!isServer) {
    afterNextRender(() => showEpisodeSkeleton.set(true), { injector });
  }

  const readParams = (params: Record<string, string | undefined>) => {
    const name = params["slug"] ?? "";
    slug.set(name);
    parentHub.set(options.parentHub(name));
    const episodeId = episodeIdFromRouteQuery(guids, params["query"] ?? "");
    isEpisode.set(episodeId !== "");
    episode.set(undefined);
    isLoading.set(true);
    return episodeId;
  };

  readParams(route.snapshot.params);

  function sendMovedKind(target: string): void {
    if (!responseInit) {
      return;
    }
    responseInit.status = 301;
    const headers = new Headers(responseInit.headers);
    headers.set("Location", target);
    responseInit.headers = headers;
  }

  async function resolvePlayable(episodeId: string): Promise<SearchResult | undefined> {
    const byName = await episodes.GetEpisodeDetailsFromApi(episodeId, slug(), options.contentKind);
    return byName ?? await episodes.getPlayableById(episodeId, options.contentKind);
  }

  function start(): void {
    route.params.pipe(takeUntilDestroyed(destroyRef)).subscribe(params => {
      const episodeId = readParams(params);
      let pageDetails: IPageDetails = { title: slug() };
      if (!episodeId) {
        seo.AddMetaTags(pageDetails);
        isLoading.set(false);
        isEpisode.set(false);
        return;
      }
      if (isServer) {
        void (async () => {
          let hadKv = false;
          try {
            const kv = await episodes.getEpisodeDetailsFromKvViaApi(episodeId, slug());
            if (kv) {
              pageDetails = kv;
              hadKv = true;
            }
          } catch (error) {
            console.error(JSON.stringify(error));
          }
          let found: SearchResult | undefined;
          try {
            found = await resolvePlayable(episodeId);
          } catch (error) {
            console.error(JSON.stringify(error));
          }
          const target = found ? movedKindRedirect(router.url, found, guids) : null;
          if (target && found) {
            pageDetails = pageDetailsFromSearchEpisode(options.seoName(found, slug()), found);
            sendMovedKind(target);
          } else if (!pageDetails.image) {
            pageDetails = hadKv
              ? withEpisodeShareImage(pageDetails, found)
              : found
                ? pageDetailsFromSearchEpisode(options.seoName(found, slug()), found)
                : pageDetails;
          }
          seo.AddMetaTags(pageDetails);
          isLoading.set(true);
        })();
        return;
      }
      let redirecting = false;
      resolvePlayable(episodeId)
        .then(found => {
          const target = found ? movedKindRedirect(router.url, found, guids) : null;
          if (target && found) {
            redirecting = true;
            pageDetails = pageDetailsFromSearchEpisode(options.seoName(found, slug()), found);
            sendMovedKind(target);
            void router.navigateByUrl(target, { replaceUrl: true });
            return;
          }
          episode.set(found);
          if (found) {
            pageDetails = pageDetailsFromSearchEpisode(options.seoName(found, slug()), found);
          }
        })
        .catch(error => console.error(error))
        .finally(() => {
          seo.AddMetaTags(pageDetails);
          if (!redirecting) {
            isLoading.set(false);
          }
        });
    });
  }

  return {
    slug,
    episode,
    isLoading,
    isEpisode,
    showEpisodeSkeleton,
    parentHub,
    displayCatalogName,
    start,
  };
}
