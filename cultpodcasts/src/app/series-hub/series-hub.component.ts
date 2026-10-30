import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from "@angular/core";
import { Location } from "@angular/common";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { skip } from "rxjs";
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
import { ActivatedRoute, Router } from "@angular/router";
import { SeriesHubMenuComponent, SeriesHubSort, seriesHubSortNewest } from "../series-hub-menu/series-hub-menu.component";
import { FragmentHistory, keepOffered, readSubjectsFromFragment, routePathKey, subjectsFragment, writeUrlFragment } from "../browse-filter-params";

@Component({
  selector: "app-series-hub",
  imports: [
    CatalogueCardComponent,
    SiteLoadingComponent,
    BrowseLoadingSkeletonComponent,
    BrowseFacetScrollerDirective,
    SeriesHubMenuComponent,
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
  /** Newest / oldest first from the hub menu. Not kept in the URL (the podcast page does the same). */
  protected readonly sort = signal<SeriesHubSort>(seriesHubSortNewest);
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
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private legacyNames = false;
  /** Subject chips from the URL fragment, applied once the hub-wide subject facets are known. */
  private pendingSubjects: string[] = [];
  /** The fragment last read from or written to the URL; the route snapshot lags a pending navigation. */
  private urlFragment: string | null = null;
  /** Path and query (no fragment) of the loaded hub, to tell Back/Forward between filters from a new page. */
  private pathKey = "";
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
      const snapshot = this.route.snapshot;
      this.pathKey = snapshot ? routePathKey(snapshot.params, snapshot.queryParams) : "";
      this.urlFragment = snapshot?.fragment || null;
      this.pendingSubjects = readSubjectsFromFragment(this.urlFragment);
      this.page = 1;
      this.load(name, hub, true, true);
    });
    // skip(1): the current fragment is the page load's; later ones are Back/Forward or echoes.
    this.route.fragment.pipe(
      skip(1),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(fragment => this.restoreFromFragment(fragment || null));
  }

  /**
   * Back/Forward between filter states on this hub: the path and query are
   * unchanged and the fragment is not the one this hub last wrote, so select
   * the chips it names and load again, as on first load. A fragment that
   * arrives with a new path or query is left to the load effect.
   */
  private restoreFromFragment(fragment: string | null): void {
    if (!this.loadedKey || fragment === this.urlFragment) {
      return;
    }
    const snapshot = this.route.snapshot;
    if (!snapshot || routePathKey(snapshot.params, snapshot.queryParams) !== this.pathKey) {
      return;
    }
    this.urlFragment = fragment;
    this.setSubjects([]);
    this.pendingSubjects = readSubjectsFromFragment(fragment);
    this.load(this.seriesName(), this.hub(), true, true);
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
        orderby: untracked(this.sort),
      }
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (data) => {
        if (refreshFacets && this.applyPendingSubjects(data.facets)) {
          return;
        }
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

  protected setSort(sort: SeriesHubSort): void {
    this.sort.set(sort);
    this.load(this.seriesName(), this.hub(), true, false);
  }

  /** After a curator's Index → Review: reload the list (and facets) with the current sort and filters. */
  protected reload(): void {
    this.load(this.seriesName(), this.hub(), true, true);
  }

  clearSubjects(): void {
    if (this.subjects().length === 0) {
      return;
    }
    this.setSubjects([]);
    this.syncFilterUrl("push");
    this.load(this.seriesName(), this.hub(), true, false);
  }

  toggleSubject(value: string): void {
    const current = this.subjects();
    const next = current.includes(value)
      ? current.filter((s) => s !== value)
      : [...current, value];
    this.setSubjects(next);
    this.syncFilterUrl("push");
    this.load(this.seriesName(), this.hub(), true, false);
  }

  private setSubjects(next: string[]): void {
    this.subjects.set(next);
    this.subjectsFilter = subjectsAnySearchIn(next);
  }

  /**
   * After the unfiltered first load, select the subject chips from the URL that
   * this hub offers (unknown ones are dropped and the URL tidied) and load
   * again. Returns true when it started that load.
   */
  private applyPendingSubjects(facets: SearchResultsFacets): boolean {
    if (this.pendingSubjects.length === 0) {
      return false;
    }
    const requested = this.pendingSubjects;
    this.pendingSubjects = [];
    const offered = facets.subjects?.filter(x => !x.value.startsWith("_"));
    const subjects = keepOffered(requested, offered);
    if (subjects.length !== requested.length) {
      this.setSubjects(subjects);
      this.syncFilterUrl();
    }
    if (subjects.length === 0) {
      return false;
    }
    this.facets.set({ subjects: offered });
    this.setSubjects(subjects);
    this.load(this.seriesName(), this.hub(), true, false);
    return true;
  }

  /**
   * Mirror the subject chips into the URL fragment (no scroll). A chip click
   * pushes a history entry so Back/Forward step through selections; tidying
   * the URL replaces. Unchanged state writes nothing.
   */
  private syncFilterUrl(history: FragmentHistory = "replace"): void {
    const fragment = subjectsFragment(this.subjects());
    if (this.urlFragment === fragment) {
      return;
    }
    this.urlFragment = fragment;
    writeUrlFragment(this.router, this.route, this.location, fragment, history);
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
