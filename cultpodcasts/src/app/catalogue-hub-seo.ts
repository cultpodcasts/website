import { isPlatformServer } from "@angular/common";
import { DestroyRef, inject, PLATFORM_ID, signal, Signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { CatalogueHub } from "./catalogue-hub";
import { EpisodeService } from "./episode.service";
import { IPageDetails } from "./page-details.interface";
import { SeoService } from "./seo.service";

/**
 * Route slug + SEO for a /news/{name} or /tv/{name} hub.
 * Server: title, description and og/twitter image from Api `/pagedetails/{hub}/{name}`, the way podcast and
 * episode pages use page details; on any failure (e.g. 400 for an empty hub) the title is the name.
 * Browser: the title only, as before (crawlers read the server render).
 * Call from an injection context; `start()` from ngOnInit.
 */
export function connectCatalogueHubSeo(hub: CatalogueHub): { slug: Signal<string>; start(): void } {
  const route = inject(ActivatedRoute);
  const destroyRef = inject(DestroyRef);
  const seo = inject(SeoService);
  const episodes = inject(EpisodeService);
  const isServer = isPlatformServer(inject(PLATFORM_ID));
  const slug = signal("");

  function start(): void {
    route.params.pipe(takeUntilDestroyed(destroyRef)).subscribe(params => {
      const name: string = params["slug"] ?? "";
      slug.set(name);
      const fallback: IPageDetails = { title: name };
      if (!isServer || !name) {
        seo.AddMetaTags(fallback);
        return;
      }
      void (async () => {
        let details: IPageDetails | undefined;
        try {
          details = await episodes.getHubPageDetailsViaApi(hub, name);
        } catch (error) {
          console.error(JSON.stringify(error));
        }
        seo.AddMetaTags(details?.title ? details : fallback);
      })();
    });
  }

  return { slug: slug.asReadonly(), start };
}
