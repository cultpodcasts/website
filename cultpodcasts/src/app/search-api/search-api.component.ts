import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { SearchResult } from '../search-result.interface';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs/internal/observable/combineLatest';
import { SiteService } from '../site.service';
import { ODataService } from '../odata.service'
import { environment } from './../../environments/environment';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DatePipe } from '@angular/common';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatChipListbox, MatChipListboxChange, MatChipOption } from '@angular/material/chips';
import { SearchResultsFacets } from '../search-results-facets.interface';
import { FacetState } from '../facet-state.interface';
import { EpisodeImageComponent } from "../episode-image/episode-image.component";
import { EpisodeLinksComponent } from "../episode-links/episode-links.component";
import { BookmarkComponent } from "../bookmark/bookmark.component";
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { SubjectsComponent } from "../subjects/subjects.component";
import { ScrollDispatcher } from '@angular/cdk/scrolling';
import { InfiniteScrollStrategy } from '../infinite-scroll-strategy';
import { SearchDescriptionPipe } from '../search-description.pipe';

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
    MatProgressBarModule,
    MatButtonModule,
    MatMenuModule,
    MatIconModule,
    MatCardModule,
    RouterLink,
    DatePipe,
    MatExpansionModule,
    MatChipListbox,
    MatChipOption,
    EpisodeImageComponent,
    EpisodeLinksComponent,
    BookmarkComponent,
    SubjectsComponent,
    SearchDescriptionPipe
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

  podcastsChange($event: MatChipListboxChange) {
    const delimiter = '£';
    var items: { count: number, value: string }[] = $event.value;
    const podcasts = items.map(x => x.value.replaceAll("'", "''"));
    this.podcasts.set(podcasts);
    if (podcasts.length == 0) {
      this.podcastsFilter = "";
    } else {
      var podcastsNameList = podcasts.join(delimiter);
      this.podcastsFilter = `search.in(podcastName, '${podcastsNameList}', '${delimiter}')`;
    }
    const reset = { subjects: true };
    this.page = 1;
    this.execSearch(true, reset);
  }

  subjectsChange($event: MatChipListboxChange) {
    const delimiter = '£';
    var items: { count: number, value: string }[] = $event.value;
    const subjects = items.map(x => x.value.replaceAll("'", "''"));
    this.subjects.set(subjects);
    if (subjects.length == 0) {
      this.subjectsFilter = "";
    } else {
      var subjectsameList = subjects.join(delimiter);
      this.subjectsFilter = `subjects/any(s: search.in(s, '${subjectsameList}', '${delimiter}'))`;
    }
    const reset = { podcasts: true };
    this.page = 1;
    this.execSearch(true, reset);
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
}
