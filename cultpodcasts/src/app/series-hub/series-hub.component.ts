import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ScrollDispatcher } from "@angular/cdk/scrolling";
import { ODataService } from "../odata.service";
import { environment } from "../../environments/environment";
import { SearchResult } from "../search-result.interface";
import { catalogueHubFilter, isUnknownContentKindField, nextLegacyNameLatch, normalizePlayableHit, subjectsAnySearchIn } from "../playable-search-hit";
import { CatalogueCardComponent } from "../catalogue-card/catalogue-card.component";
import { SiteLoadingComponent } from "../site-loading/site-loading.component";
import { BrowseLoadingSkeletonComponent } from "../browse-loading-skeleton/browse-loading-skeleton.component";
import { BrowseFacetScrollerDirective } from "../browse-facet-scroller.directive";
import { PlayerService } from "../player.service";
import { SearchDisplayEpisode } from "../search-result-links";
import { startEpisodePlayback } from "../episode-embed";
import { displayCatalogName } from "../display-catalog-name";
import { SearchResultsFacets } from "../search-results-facets.interface";
import { InfiniteScrollStrategy } from "../infinite-scroll-strategy";

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
  providers: [InfiniteScrollStrategy],
})
export class SeriesHubComponent {
  readonly seriesName = input.required<string>();
  readonly hub = input.required<"tv" | "news">();
  protected readonly results = signal<SearchResult[]>([]);
  protected readonly count = signal(0);
  protected readonly isLoading = signal(true);
  protected readonly isSubsequentLoading = signal(false);
  protected readonly error = signal("");
  protected readonly facets = signal<SearchResultsFacets>({});
  protected readonly subjects = signal<string[]>([]);
  protected readonly displayCatalogName = displayCatalogName;
  protected readonly playerService = inject(PlayerService);
  protected readonly itemNoun = computed(() => this.hub() === "news" ? "report" : "episode");
  readonly loadingLabel = computed(() => {
    const noun = `${this.itemNoun()}s`;
    return this.isSubsequentLoading() ? `Loading more ${noun}` : `Loading ${noun}`;
  });
  private readonly oData = inject(ODataService);
  private readonly scrollDispatcher = inject(ScrollDispatcher);
  private readonly infiniteScrollStrategy = inject(InfiniteScrollStrategy);
  private readonly destroyRef = inject(DestroyRef);
  private legacyNames = false;
  private subjectsFilter = "";
  private page = 1;
  private scrollSubscribed = false;
  private loadedKey = "";

  constructor() {
    effect(() => {
      const name = this.seriesName();
      const hub = this.hub();
      if (!name) {
        return;
      }
      const key = `${hub}:${name}`;
      if (key === this.loadedKey) {
        return;
      }
      this.loadedKey = key;
      this.legacyNames = false;
      this.subjects.set([]);
      this.subjectsFilter = "";
      this.page = 1;
      this.load(name, hub, true, true);
    });
  }

  private load(name: string, hub: "tv" | "news", reset: boolean, refreshFacets: boolean): void {
    if (reset) {
      this.page = 1;
      this.isLoading.set(true);
    }
    this.error.set("");
    this.oData.getEntitiesWithFacets<SearchResult>(
      new URL("/search", environment.api).toString(),
      {
        search: "",
        filter: catalogueHubFilter(name, hub, this.legacyNames) + this.subjectsFilter,
        searchMode: "any",
        queryType: "simple",
        count: true,
        skip: this.infiniteScrollStrategy.getSkip(this.page),
        top: this.infiniteScrollStrategy.getTake(this.page),
        facets: ["subjects,count:1000,sort:count"],
        orderby: "release desc",
      }
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        const count = data.metadata.get("count");
        this.count.set(typeof count === "number" ? count : data.entities.length);
        if (!this.scrollSubscribed && data.entities.length && !this.results().length) {
          this.scrollSubscribed = true;
          this.scrollDispatcher.scrolled().pipe(
            takeUntilDestroyed(this.destroyRef)
          ).subscribe(() => {
            if (this.results().length < this.count() &&
              this.isScrolledToBottom() &&
              !this.isSubsequentLoading()) {
              this.isSubsequentLoading.set(true);
              this.page++;
              this.load(this.seriesName(), this.hub(), false, false);
            }
          });
        }
        const hits = data.entities.map((hit) => normalizePlayableHit(hit));
        if (reset) {
          this.results.set(hits);
        } else {
          this.results.update((current) => current.concat(hits));
        }
        this.isSubsequentLoading.set(false);
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
          this.isSubsequentLoading.set(false);
          return;
        }
        const latch = nextLegacyNameLatch(this.legacyNames, error);
        if (latch.retry) {
          this.legacyNames = latch.legacyNames;
          this.load(name, hub, reset, refreshFacets);
          return;
        }
        this.error.set("Something went wrong. Please try again.");
        this.isLoading.set(false);
        this.isSubsequentLoading.set(false);
      },
    });
  }

  clearSubjects(): void {
    if (this.subjects().length === 0) {
      return;
    }
    this.subjects.set([]);
    this.subjectsFilter = "";
    this.load(this.seriesName(), this.hub(), true, false);
  }

  toggleSubject(value: string): void {
    const current = this.subjects();
    const next = current.includes(value)
      ? current.filter((s) => s !== value)
      : [...current, value];
    this.subjects.set(next);
    this.subjectsFilter = subjectsAnySearchIn(next);
    this.load(this.seriesName(), this.hub(), true, false);
  }

  protected playEpisode(episode: SearchDisplayEpisode): void {
    startEpisodePlayback(episode, (playable) => this.playerService.play(playable));
  }

  isScrolledToBottom(): boolean {
    const scrollPosition = window.scrollY + window.innerHeight;
    const threshold = document.documentElement.scrollHeight - this.infiniteScrollStrategy.getYThreshold(this.page);
    return scrollPosition >= threshold;
  }
}
