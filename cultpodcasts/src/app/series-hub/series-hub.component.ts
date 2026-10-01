import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ODataService } from "../odata.service";
import { environment } from "../../environments/environment";
import { SearchResult } from "../search-result.interface";
import { catalogueHubFilter, isUnknownContentKindField, nextLegacyNameLatch, normalizePlayableHit } from "../playable-search-hit";
import { CatalogueCardComponent } from "../catalogue-card/catalogue-card.component";
import { SiteLoadingComponent } from "../site-loading/site-loading.component";
import { PlayerService } from "../player.service";
import { SearchDisplayEpisode } from "../search-result-links";
import { startEpisodePlayback } from "../episode-embed";
import { displayCatalogName } from "../display-catalog-name";

@Component({
  selector: "app-series-hub",
  imports: [CatalogueCardComponent, SiteLoadingComponent],
  templateUrl: "./series-hub.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeriesHubComponent {
  readonly seriesName = input.required<string>();
  readonly hub = input.required<"tv" | "news">();
  protected readonly results = signal<SearchResult[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly error = signal("");
  protected readonly displayCatalogName = displayCatalogName;
  private readonly oData = inject(ODataService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly player = inject(PlayerService);
  private legacyNames = false;

  constructor() {
    effect(() => {
      const name = this.seriesName();
      const hub = this.hub();
      if (!name) {
        return;
      }
      this.legacyNames = false;
      this.load(name, hub);
    });
  }

  private load(name: string, hub: "tv" | "news"): void {
    this.isLoading.set(true);
    this.error.set("");
    this.oData.getEntities<SearchResult>(
      new URL("/search", environment.api).toString(),
      {
        search: "",
        filter: catalogueHubFilter(name, hub, this.legacyNames),
        searchMode: "any",
        queryType: "simple",
        count: true,
        skip: 0,
        top: 24,
        facets: [],
        orderby: "release desc",
      }
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        this.results.set(data.entities.map((hit) => normalizePlayableHit(hit)));
        this.isLoading.set(false);
      },
      error: (error) => {
        if (isUnknownContentKindField(error)) {
          this.results.set([]);
          this.error.set("");
          this.isLoading.set(false);
          return;
        }
        const latch = nextLegacyNameLatch(this.legacyNames, error);
        if (latch.retry) {
          this.legacyNames = latch.legacyNames;
          this.load(name, hub);
          return;
        }
        this.error.set("Something went wrong. Please try again.");
        this.isLoading.set(false);
      },
    });
  }

  protected playEpisode(episode: SearchDisplayEpisode): void {
    startEpisodePlayback(episode, (playable) => this.player.play(playable));
  }
}
