import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
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
import { EpisodePosterComponent } from '../episode-poster/episode-poster.component';
import { EpisodePlayerComponent } from '../episode-player/episode-player.component';
import { SiteLoadingComponent } from '../site-loading/site-loading.component';
import { SearchDisplayEpisode } from '../search-result-links';
import { canPlayEpisode } from '../episode-embed';
import { SearchResultsFacets } from '../search-results-facets.interface';
import { FacetState } from '../facet-state.interface';

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
    EpisodePosterComponent,
    EpisodePlayerComponent,
    SiteLoadingComponent,
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
  private podcastsFilter: string = "";
  private subjectsFilter: string = "";
  protected isSubsequentLoading = signal<boolean>(false);
  protected results = signal<SearchResult[]>([]);
  protected playingEpisode = signal<SearchDisplayEpisode | undefined>(undefined);
  private scrollSubscribed = false;
  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
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
      [this.route.params, this.route.queryParams],
      (params: Params, queryParams: Params) => ({
        params,
        queryParams,
      })
    ).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((res: { params: Params; queryParams: Params }) => {
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
        this.podcasts.set([]);
        this.subjects.set([]);
        this.facets.update(f => ({ ...f, subjects: [], podcastName: [] }));
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
          this.subjectsFilter),
        searchMode: 'any',
        queryType: 'simple',
        count: true,
        skip: this.infiniteScrollStrategy.getSkip(this.page),
        top: this.infiniteScrollStrategy.getTake(this.page),
        facets: ["podcastName,count:1000,sort:count", "subjects,count:1000,sort:count"],
        orderby: sort
      }).subscribe({
        next: data => {
          const count: number = data.metadata.get("count");
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
            this.results.set(data.entities);
          } else {
            this.results.update(v => v.concat(data.entities));
          }
          this.isSubsequentLoading.set(false);
          if (subsequent) {
            if (subsequent.podcasts) {
              this.facets.update(f => ({ ...f, podcastName: data.facets.podcastName }));
            }
            if (subsequent.subjects) {
              this.facets.update(f => ({ ...f, subjects: data.facets.subjects?.filter(x => !x.value.startsWith("_")) }));
            }
          } else {
            if (reset?.podcasts) {
              this.facets.update(f => ({ ...f, podcastName: data.facets.podcastName }));
            }
            if (reset?.subjects) {
              this.facets.update(f => ({ ...f, subjects: data.facets.subjects }));
            }
          }
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
    this.router.navigate([url], { queryParams: params });
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
    this.execSearch(true, { podcasts: true });
  }

  toggleSubject(value: string): void {
    const current = this.subjects();
    const next = current.includes(value)
      ? current.filter((s) => s !== value)
      : [...current, value];
    this.subjects.set(next);
    this.subjectsFilter = next.length === 0
      ? ''
      : `subjects/any(s: search.in(s, '${next.map((s) => s.replaceAll("'", "''")).join('£')}', '£'))`;
    this.page = 1;
    this.execSearch(true, { podcasts: true });
  }

  clearPodcasts(): void {
    if (this.podcasts().length === 0) {
      return;
    }
    this.podcasts.set([]);
    this.podcastsFilter = '';
    this.page = 1;
    this.execSearch(true, { subjects: true });
  }

  togglePodcast(value: string): void {
    const current = this.podcasts();
    const next = current.includes(value)
      ? current.filter((p) => p !== value)
      : [...current, value];
    this.podcasts.set(next);
    this.podcastsFilter = next.length === 0
      ? ''
      : `search.in(podcastName, '${next.map((p) => p.replaceAll("'", "''")).join('£')}', '£')`;
    this.page = 1;
    this.execSearch(true, { subjects: true });
  }

  clearAllFilters(): void {
    this.subjects.set([]);
    this.podcasts.set([]);
    this.subjectsFilter = '';
    this.podcastsFilter = '';
    this.page = 1;
    this.execSearch(true, { subjects: true, podcasts: true });
  }

  isScrolledToBottom(): boolean {
    const scrollPosition = window.scrollY + window.innerHeight;
    const threshold = document.documentElement.scrollHeight - this.infiniteScrollStrategy.getYThreshold(this.page);
    return scrollPosition >= threshold;
  }

  buildFilter(baseFilter: string | null, podcastsFilter: string, subjectsFilter: string): string {
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
    return filter;
  }

  playEpisode(episode: SearchDisplayEpisode): void {
    if (!canPlayEpisode(episode)) {
      return;
    }
    this.playingEpisode.set(episode);
  }

  closePlayer(): void {
    this.playingEpisode.set(undefined);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.playingEpisode()) {
      this.closePlayer();
    }
  }
}
