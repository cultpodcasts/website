import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ODataService } from "../odata.service";
import { environment } from "../../environments/environment";
import { SearchResult } from "../search-result.interface";
import { catalogueHubFilter, escapedOData, isUnknownContentKindField, nextLegacyNameLatch, normalizePlayableHit } from "../playable-search-hit";
import { CatalogueCardComponent } from "../catalogue-card/catalogue-card.component";
import { SiteLoadingComponent } from "../site-loading/site-loading.component";
import { BrowseLoadingSkeletonComponent } from "../browse-loading-skeleton/browse-loading-skeleton.component";
import { BrowseFacetScrollerDirective } from "../browse-facet-scroller.directive";
import { PlayerService } from "../player.service";
import { SearchDisplayEpisode } from "../search-result-links";
import { startEpisodePlayback } from "../episode-embed";
import { displayCatalogName } from "../display-catalog-name";
import { SearchResultsFacets } from "../search-results-facets.interface";

@Component({
  selector: "app-series-hub",
  imports: [
    CatalogueCardComponent,
    SiteLoadingComponent,
    BrowseLoadingSkeletonComponent,
    BrowseFacetScrollerDirective,
  ],
  templateUrl: "./series-hub.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeriesHubComponent {
  readonly seriesName = input.required<string>();
  readonly hub = input.required<"tv" | "news">();
  protected readonly results = signal<SearchResult[]>([]);
  protected readonly count = signal(0);
  protected readonly isLoading = signal(true);
  protected readonly error = signal("");
  protected readonly facets = signal<SearchResultsFacets>({});
  protected readonly subjects = signal<string[]>([]);
  protected readonly displayCatalogName = displayCatalogName;
  protected readonly playerService = inject(PlayerService);
  protected readonly itemNoun = computed(() => this.hub() === "news" ? "report" : "episode");
  private readonly oData = inject(ODataService);
  private readonly destroyRef = inject(DestroyRef);
  private legacyNames = false;
  private subjectsFilter = "";

  constructor() {
    effect(() => {
      const name = this.seriesName();
      const hub = this.hub();
      if (!name) {
        return;
      }
      this.legacyNames = false;
      this.subjects.set([]);
      this.subjectsFilter = "";
      this.load(name, hub, true);
    });
  }

  private load(name: string, hub: "tv" | "news", refreshFacets: boolean): void {
    this.isLoading.set(true);
    this.error.set("");
    this.oData.getEntitiesWithFacets<SearchResult>(
      new URL("/search", environment.api).toString(),
      {
        search: "",
        filter: catalogueHubFilter(name, hub, this.legacyNames) + this.subjectsFilter,
        searchMode: "any",
        queryType: "simple",
        count: true,
        skip: 0,
        top: 24,
        facets: ["subjects,count:1000,sort:count"],
        orderby: "release desc",
      }
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        const count = data.metadata.get("count");
        this.count.set(typeof count === "number" ? count : data.entities.length);
        this.results.set(data.entities.map((hit) => normalizePlayableHit(hit)));
        if (refreshFacets) {
          this.facets.set({
            subjects: data.facets.subjects?.filter(x => !x.value.startsWith("_")),
          });
        }
        this.isLoading.set(false);
      },
      error: (error) => {
        if (isUnknownContentKindField(error)) {
          this.results.set([]);
          this.count.set(0);
          this.error.set("");
          this.isLoading.set(false);
          return;
        }
        const latch = nextLegacyNameLatch(this.legacyNames, error);
        if (latch.retry) {
          this.legacyNames = latch.legacyNames;
          this.load(name, hub, refreshFacets);
          return;
        }
        this.error.set("Something went wrong. Please try again.");
        this.isLoading.set(false);
      },
    });
  }

  protected clearSubjects(): void {
    if (this.subjects().length === 0) {
      return;
    }
    this.subjects.set([]);
    this.subjectsFilter = "";
    this.load(this.seriesName(), this.hub(), false);
  }

  protected toggleSubject(value: string): void {
    const current = this.subjects();
    const next = current.includes(value)
      ? current.filter((s) => s !== value)
      : [...current, value];
    this.subjects.set(next);
    this.subjectsFilter = next.length === 0
      ? ""
      : ` and subjects/any(s: search.in(s, '${next.map((s) => escapedOData(s)).join("£")}', '£'))`;
    this.load(this.seriesName(), this.hub(), false);
  }

  protected playEpisode(episode: SearchDisplayEpisode): void {
    startEpisodePlayback(episode, (playable) => this.playerService.play(playable));
  }
}
