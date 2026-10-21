import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { SearchResult } from '../search-result.interface';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { combineLatest } from 'rxjs/internal/observable/combineLatest';
import { SiteService } from '../site.service';
import { ODataService } from '../odata.service'
import { environment } from './../../environments/environment';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { ScrollDispatcher } from '@angular/cdk/scrolling';
import { InfiniteScrollStrategy } from '../infinite-scroll-strategy';
import { CatalogueCardComponent } from '../catalogue-card/catalogue-card.component';
import { SiteLoadingComponent } from '../site-loading/site-loading.component';
import { BrowseLoadingSkeletonComponent } from '../browse-loading-skeleton/browse-loading-skeleton.component';
import { BrowseFacetScrollerDirective } from '../browse-facet-scroller.directive';
import { SearchDisplayEpisode } from '../search-result-links';
import { startEpisodePlayback } from '../episode-embed';
import { SearchResultsFacets } from '../search-results-facets.interface';
import { FacetState } from '../facet-state.interface';
import { displayCatalogName } from '../display-catalog-name';
import { contentKindLabel } from '../content-kind-label';
import { isUnknownContentKindField, isUnknownSearchFieldError, nextLegacyNameLatch, normalizePlayableHit, playableSeriesField, rewritePlayableSeriesField, subjectsAnySearchIn } from '../playable-search-hit';
import { PlayerService } from '../player.service';
import { KIND_PARAM, SHOW_PARAM, SUBJECT_PARAM, keepOffered, writeUrlFragment, FragmentHistory, readParamList, parseFilterFragment, buildFilterFragment, routeStateKey } from '../browse-filter-params';

interface RestoredFilters {
  podcasts: string[];
  subjects: string[];
  kinds: string[];
}

const sortParam: string = "sort";
const pageParam: string = "page";
const queryParam: string = "query";
const filterParam: string = "filter";
const sortParamRank: string = "rank";
const sortParamDateAsc: string = "date-asc";
const sortParamDateDesc: string = "date-desc";

@Component({
  selector: 'app-search-api',
  imports: [
    MatButtonModule,
    MatMenuModule,
    MatIconModule,
    CatalogueCardComponent,
    SiteLoadingComponent,
    BrowseLoadingSkeletonComponent,
    BrowseFacetScrollerDirective,
  ],
  templateUrl: './search-api.component.html',
  styleUrl: './search-api.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class SearchApiComponent {
  protected query = signal<string>("");
  protected sortOrder = signal<string>(sortParamRank);
  private page: number = 1;
  private filter: string | null = null;

  sortParamRank: string = sortParamRank;
  sortParamDateAsc: string = sortParamDateAsc;
  sortParamDateDesc: string = sortParamDateDesc;

  protected resultsHeading = signal<string>("");
  protected isLoading = signal<boolean>(true);
  protected facets = signal<SearchResultsFacets>({});
  protected subjects = signal<string[]>([]);
  protected podcasts = signal<string[]>([]);
  protected kinds = signal<string[]>([]);
  private podcastsFilter: string = "";
  private subjectsFilter: string = "";
  private kindsFilter: string = "";
  /** include until the index says contentKind is missing. probing is the one retry without it. */
  private contentKindMode: "include" | "probing" | "omit" = "include";
  private legacyNames = false;
  protected isSubsequentLoading = signal<boolean>(false);
  protected results = signal<SearchResult[]>([]);
  protected readonly playerService = inject(PlayerService);
  protected readonly displayCatalogName = displayCatalogName;
  protected readonly contentKindLabel = contentKindLabel;
  private scrollSubscribed = false;
  /** Chips from the URL, applied once the unfiltered facets for this query are known. */
  private pendingRestore: RestoredFilters | null = null;
  private routeParams: Params = {};
  private routeQueryParams: Params = {};
  private routeKey: string | null = null;
  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  protected auth = inject(AuthServiceWrapper);
  protected isSignedIn = toSignal(this.auth.isSignedIn, { initialValue: false });

  constructor(
    private router: Router,
    private siteService: SiteService,
    private oDataService: ODataService,
    private scrollDispatcher: ScrollDispatcher,
    private infiniteScrollStrategy: InfiniteScrollStrategy
  ) {
  }

  ngOnInit() {
    this.populatePage();
  }

  populatePage() {
    combineLatest(
      [this.route.params, this.route.queryParams, this.route.fragment],
      (params: Params, queryParams: Params, fragment: string | null) => ({
        params,
        queryParams,
        fragment,
      })
    ).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((res: { params: Params; queryParams: Params; fragment: string | null }) => {
      const key = routeStateKey(res.params, res.queryParams, res.fragment);
      if (key === this.routeKey) {
        // This page wrote the URL (filter chip click); state and results are current.
        return;
      }
      this.routeKey = key;
      this.routeParams = res.params;
      this.routeQueryParams = res.queryParams;
      const navigation = this.router.currentNavigation();
      let initial = true;
      if (navigation) {
        const facetState = navigation.extras.state as FacetState;
        if (facetState) {
          initial = false;
          this.facets.set(facetState.searchResultsFacets);
          if (!facetState.resetPodcasts) {
            this.podcasts.set(facetState.podcasts!);
          }
          if (!facetState.resetSubjects) {
            this.subjects.set(facetState.subjects!);
          }
        }
      }

      if (initial) {
        this.podcastsFilter = "";
        this.subjectsFilter = "";
        this.kindsFilter = "";
        this.podcasts.set([]);
        this.subjects.set([]);
        this.kinds.set([]);
        this.facets.update(f => ({ ...f, subjects: [], podcastName: [], contentKind: [] }));
        this.pendingRestore = this.filtersFromUrl(parseFilterFragment(res.fragment));
      }

      const { params, queryParams } = res;
      this.query.set(params[queryParam]);
      this.isLoading.set(true);
      this.siteService.setQuery(params[queryParam]);
      this.siteService.setPodcast(null);
      this.siteService.setSubject(null);

      if (queryParams[pageParam]) {
        this.page = parseInt(queryParams[pageParam]);
      } else {
        this.page = 1;
      }

      if (queryParams[sortParam]) {
        this.sortOrder.set(queryParams[sortParam]);
      } else {
        this.sortOrder.set(sortParamRank);
      }

      if (queryParams[filterParam]) {
        this.filter = queryParams[filterParam];
      } else {
        this.filter = "";
      }
      this.execSearch(initial, undefined, { podcasts: initial, subjects: initial });
    });
  }

  execSearch(initial: boolean, reset?: { podcasts?: boolean, subjects?: boolean }, subsequent?: { podcasts?: boolean, subjects?: boolean }) {
    var sort: string = "";

    if (this.sortOrder() == "date-asc") {
      sort = "release asc";
    } else if (this.sortOrder() == "date-desc") {
      sort = "release desc";
    }
    this.oDataService.getEntitiesWithFacets<SearchResult>(
      new URL("/search", environment.api).toString(),
      {
        search: this.query(),
        filter: this.buildFilter(
          this.filter,
          this.podcastsFilter,
          this.subjectsFilter,
          this.requestedKindsFilter()),
        searchMode: 'any',
        queryType: 'simple',
        count: true,
        skip: this.infiniteScrollStrategy.getSkip(this.page),
        top: this.infiniteScrollStrategy.getTake(this.page),
        facets: this.searchFacets(),
        orderby: sort
      }).subscribe({
        next: data => {
          const count: number = data.metadata.get("count");
          this.updateFacets(data.facets, reset, subsequent);
          if (this.applyPendingRestore()) {
            return;
          }
          if (!this.scrollSubscribed && data.entities.length && !this.results().length) {
            this.scrollSubscribed = true;
            this.scrollDispatcher.scrolled().pipe(
              takeUntilDestroyed(this.destroyRef)
            ).subscribe(async () => {
              if (this.results().length < count &&
                this.isScrolledToBottom() &&
                !this.isSubsequentLoading()) {
                this.isSubsequentLoading.set(true);
                this.page++;
                this.execSearch(false, undefined, { podcasts: false, subjects: false });
              }
            });
          }
          if (initial) {
            this.results.set(data.entities.map(hit => normalizePlayableHit(hit)));
          } else {
            this.results.update(v => v.concat(data.entities.map(hit => normalizePlayableHit(hit))));
          }
          this.isSubsequentLoading.set(false);
          let resultsSummary: String = `${count} results`;
          if (count === 0) {
            resultsSummary = `0 results`;
          } else if (count === 1) {
            resultsSummary = `1 result`;
          }

          let presentableQuery: string = this.query();
          if ((presentableQuery.startsWith("'") && presentableQuery.endsWith("'")) ||
            (presentableQuery.startsWith("\"") && presentableQuery.endsWith("\""))) {
            presentableQuery = presentableQuery.substring(1, presentableQuery.length - 1);
          }

          this.resultsHeading.set(`Found ${resultsSummary} for "${presentableQuery}"`);
          this.isLoading.set(false);
        },
        error: (e) => {
          if (this.recoverSearch(e)) {
            this.execSearch(initial, reset, subsequent);
            return;
          }
          console.error(e);
          this.resultsHeading.set("Something went wrong. Please try again.");
          this.isLoading.set(false);
        }
      });
  }

  setSort(sort: string) {
    var url = `/search/${this.query()}`;
    var params: Params = {};
    if (sort != sortParamRank) {
      params[sortParam] = sort;
    }
    this.router.navigate([url], { queryParams: params, fragment: buildFilterFragment(this.filterParams()) ?? undefined });
  }

  protected sortLabel = computed(() => {
    switch (this.sortOrder()) {
      case sortParamDateAsc:
        return 'Oldest first';
      case sortParamDateDesc:
        return 'Newest first';
      default:
        return 'Suggestions';
    }
  });

  clearSubjects(): void {
    if (this.subjects().length === 0) {
      return;
    }
    this.subjects.set([]);
    this.subjectsFilter = '';
    this.page = 1;
    this.syncFilterUrl('push');
    this.execSearch(true, { podcasts: true });
  }

  toggleSubject(value: string): void {
    const current = this.subjects();
    const next = current.includes(value)
      ? current.filter((s) => s !== value)
      : [...current, value];
    this.setSubjects(next);
    this.page = 1;
    this.syncFilterUrl('push');
    this.execSearch(true, { podcasts: true });
  }

  clearPodcasts(): void {
    if (this.podcasts().length === 0) {
      return;
    }
    this.podcasts.set([]);
    this.podcastsFilter = '';
    this.page = 1;
    this.syncFilterUrl('push');
    this.execSearch(true, { subjects: true });
  }

  togglePodcast(value: string): void {
    const current = this.podcasts();
    const next = current.includes(value)
      ? current.filter((p) => p !== value)
      : [...current, value];
    this.setPodcasts(next);
    this.page = 1;
    this.syncFilterUrl('push');
    this.execSearch(true, { subjects: true });
  }

  clearAllFilters(): void {
    this.subjects.set([]);
    this.podcasts.set([]);
    this.kinds.set([]);
    this.subjectsFilter = '';
    this.podcastsFilter = '';
    this.kindsFilter = '';
    this.page = 1;
    this.syncFilterUrl('push');
    this.execSearch(true, { subjects: true, podcasts: true });
  }

  toggleKind(value: string): void {
    const current = this.kinds();
    const next = current.includes(value)
      ? current.filter((k) => k !== value)
      : [...current, value];
    this.setKinds(next);
    this.page = 1;
    this.syncFilterUrl('push');
    this.execSearch(true, { subjects: true, podcasts: true });
  }

  clearKinds(): void {
    if (this.kinds().length === 0) {
      return;
    }
    this.kinds.set([]);
    this.kindsFilter = '';
    this.page = 1;
    this.syncFilterUrl('push');
    this.execSearch(true, { subjects: true, podcasts: true });
  }

  private setSubjects(next: string[]): void {
    this.subjects.set(next);
    this.subjectsFilter = subjectsAnySearchIn(next).replace(/^ and /, "");
  }

  private setPodcasts(next: string[]): void {
    this.podcasts.set(next);
    this.podcastsFilter = next.length === 0
      ? ''
      : `search.in(${playableSeriesField(this.legacyNames)}, '${next.map((p) => p.replaceAll("'", "''")).join('£')}', '£')`;
  }

  private setKinds(next: string[]): void {
    this.kinds.set(next);
    this.kindsFilter = next.length === 0
      ? ''
      : `search.in(contentKind, '${next.map((k) => k.replaceAll("'", "''")).join('£')}', '£')`;
  }

  private updateFacets(
    facets: SearchResultsFacets,
    reset?: { podcasts?: boolean, subjects?: boolean },
    subsequent?: { podcasts?: boolean, subjects?: boolean }
  ): void {
    if (subsequent) {
      if (subsequent.podcasts) {
        this.facets.update(f => ({ ...f, podcastName: facets.seriesName ?? facets.podcastName }));
      }
      if (subsequent.subjects) {
        this.facets.update(f => ({ ...f, subjects: facets.subjects?.filter(x => !x.value.startsWith("_")) }));
      }
    } else {
      if (reset?.podcasts) {
        this.facets.update(f => ({ ...f, podcastName: facets.seriesName ?? facets.podcastName }));
      }
      if (reset?.subjects) {
        this.facets.update(f => ({ ...f, subjects: facets.subjects }));
      }
    }
    if (this.contentKindMode === "probing") {
      this.contentKindMode = "omit";
      this.kindsFilter = "";
      this.kinds.set([]);
    } else if (this.contentKindMode === "include" && !this.kindsFilter && facets.contentKind) {
      this.facets.update(f => ({ ...f, contentKind: facets.contentKind }));
    }
  }

  private filtersFromUrl(filters: Params): RestoredFilters | null {
    const restored = {
      podcasts: readParamList(filters, SHOW_PARAM),
      subjects: readParamList(filters, SUBJECT_PARAM),
      kinds: readParamList(filters, KIND_PARAM),
    };
    return restored.podcasts.length || restored.subjects.length || restored.kinds.length
      ? restored
      : null;
  }

  /**
   * After the unfiltered first load has filled the chip lists, select the chips
   * from the URL that those lists offer (unknown values are ignored and the
   * URL tidied) and search again. The unfiltered results are never shown.
   * Returns true when it started that search.
   */
  private applyPendingRestore(): boolean {
    const restore = this.pendingRestore;
    if (!restore) {
      return false;
    }
    this.pendingRestore = null;
    const facets = this.facets();
    const podcasts = keepOffered(restore.podcasts, facets.podcastName);
    const subjects = keepOffered(restore.subjects, facets.subjects);
    const kinds = this.contentKindMode === "include" ? keepOffered(restore.kinds, facets.contentKind) : [];
    const dropped = podcasts.length !== restore.podcasts.length
      || subjects.length !== restore.subjects.length
      || kinds.length !== restore.kinds.length;
    if (podcasts.length === 0 && subjects.length === 0 && kinds.length === 0) {
      if (dropped) {
        this.syncFilterUrl();
      }
      return false;
    }
    this.setPodcasts(podcasts);
    this.setSubjects(subjects);
    this.setKinds(kinds);
    if (dropped) {
      this.syncFilterUrl();
    }
    this.page = 1;
    this.execSearch(true);
    return true;
  }

  private filterParams(): Record<string, string[]> {
    return {
      [SHOW_PARAM]: this.podcasts(),
      [SUBJECT_PARAM]: this.subjects(),
      [KIND_PARAM]: this.kinds(),
    };
  }

  /**
   * Mirror the filter chips into the URL fragment (path and query kept). A
   * user's filter change pushes a history entry so Back/Forward step through
   * selections (populatePage restores each from its fragment); restoring or
   * tidying the URL replaces. Unchanged state writes nothing.
   */
  private syncFilterUrl(history: FragmentHistory = 'replace'): void {
    const fragment = buildFilterFragment(this.filterParams());
    const key = routeStateKey(this.routeParams, this.routeQueryParams, fragment);
    if (key === this.routeKey) {
      return;
    }
    this.routeKey = key;
    writeUrlFragment(this.router, this.route, this.location, fragment, history);
  }

  isScrolledToBottom(): boolean {
    const scrollPosition = window.scrollY + window.innerHeight;
    const threshold = document.documentElement.scrollHeight - this.infiniteScrollStrategy.getYThreshold(this.page);
    return scrollPosition >= threshold;
  }

  private searchFacets(): string[] {
    const facets = [
      `${playableSeriesField(this.legacyNames)},count:1000,sort:count`,
      "subjects,count:1000,sort:count",
    ];
    if (this.contentKindMode === "include") {
      facets.push("contentKind,count:10");
    }
    return facets;
  }

  /** Kind filter uses contentKind. Leave it off while that field is being dropped. */
  private requestedKindsFilter(): string {
    return this.contentKindMode === "include" ? this.kindsFilter : "";
  }

  /**
   * A missing contentKind field is not a series-name miss. Drop the facet and the kind
   * filter and retry once. Only a later unknown-field response flips the series latch.
   */
  private recoverSearch(error: unknown): boolean {
    if (this.contentKindMode === "probing") {
      this.contentKindMode = "include";
      if (!isUnknownSearchFieldError(error)) {
        return false;
      }
      return this.adoptLegacyField(error);
    }
    if (this.shouldDropContentKind(error)) {
      this.contentKindMode = "probing";
      return true;
    }
    return this.adoptLegacyField(error);
  }

  private shouldDropContentKind(error: unknown): boolean {
    return this.contentKindMode === "include" && isUnknownContentKindField(error);
  }

  private adoptLegacyField(error: unknown): boolean {
    const next = nextLegacyNameLatch(this.legacyNames, error);
    if (next.retry) {
      this.legacyNames = true;
      this.podcastsFilter = rewritePlayableSeriesField(this.podcastsFilter, true);
      return true;
    }
    if (this.legacyNames && !next.legacyNames) {
      this.legacyNames = false;
      this.podcastsFilter = rewritePlayableSeriesField(this.podcastsFilter, false);
    }
    return false;
  }

  buildFilter(baseFilter: string | null, podcastsFilter: string, subjectsFilter: string, kindsFilter = ""): string {
    let filter: string = "";
    if (baseFilter && baseFilter != "") {
      filter = baseFilter;
    }
    if (podcastsFilter && podcastsFilter != "") {
      if (filter.length > 0) {
        filter += " and ";
      }
      filter += podcastsFilter;
    }
    if (subjectsFilter && subjectsFilter != "") {
      if (filter.length > 0) {
        filter += " and ";
      }
      filter += subjectsFilter;
    }
    if (kindsFilter && kindsFilter != "") {
      if (filter.length > 0) {
        filter += " and ";
      }
      filter += kindsFilter;
    }
    return filter;
  }

  playEpisode(episode: SearchDisplayEpisode): void {
    startEpisodePlayback(episode, (playable) => this.playerService.play(playable));
  }

  isPlayingId(id: string): boolean {
    return this.playerService.episode()?.id === id;
  }

  isQueuedId(id: string): boolean {
    return this.playerService.isQueuedId(id);
  }
}
