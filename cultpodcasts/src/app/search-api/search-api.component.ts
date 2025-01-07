import { Component, inject, signal } from '@angular/core';
import { SearchResult } from '../search-result.interface';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs/internal/observable/combineLatest';
import { SiteService } from '../site.service';
import { SearchState } from '../search-state.interface';
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
    SubjectsComponent
  ],
  templateUrl: './search-api.component.html',
  styleUrl: './search-api.component.sass'
})

export class SearchApiComponent {
  searchState: SearchState = {
    query: "",
    page: 1,
    sort: sortParamRank,
    filter: null
  }

  prevPage: number = 0;
  nextPage: number = 0;
  sortParamRank: string = sortParamRank;
  sortParamDateAsc: string = sortParamDateAsc;
  sortParamDateDesc: string = sortParamDateDesc;

  resultsHeading: string = "";
  isLoading: boolean = true;
  facets: SearchResultsFacets = {};
  subjects: string[] = [];
  podcasts: string[] = [];
  subjectsFilter: string = "";
  podcastsFilter: string = "";
  isSignedIn: boolean = false;
  protected isSubsequentLoading = signal<boolean>(false);
  protected results = signal<SearchResult[]>([]);

  constructor(
    private router: Router,
    private siteService: SiteService,
    private oDataService: ODataService,
    protected auth: AuthServiceWrapper,
    private scrollDisplatcher: ScrollDispatcher,
    private infiniteScrollStrategy: InfiniteScrollStrategy
  ) {
    this.auth.isSignedIn.subscribe(isSignedIn => this.isSignedIn = isSignedIn);
  }
  private route = inject(ActivatedRoute);

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
    ).subscribe((res: { params: Params; queryParams: Params }) => {
      const navigation = this.router.getCurrentNavigation();
      let initial = true;
      if (navigation) {
        const facetState = navigation.extras.state as FacetState;
        if (facetState) {
          initial = false;
          this.facets = facetState.searchResultsFacets;
          if (!facetState.resetPodcasts) {
            this.podcasts = facetState.podcasts!;
          }
          if (!facetState.resetSubjects) {
            this.subjects = facetState.subjects!;
          }
        }
      }

      if (initial) {
        this.podcastsFilter = "";
        this.subjectsFilter = "";
        this.podcasts = [];
        this.subjects = [];
        this.facets.subjects = [];
        this.facets.podcastName = [];
      }

      const { params, queryParams } = res;
      this.searchState.query = params[queryParam];
      this.isLoading = true;
      this.siteService.setQuery(params[queryParam]);
      this.siteService.setPodcast(null);
      this.siteService.setSubject(null);

      if (queryParams[pageParam]) {
        this.searchState.page = parseInt(queryParams[pageParam]);
        this.prevPage = this.searchState.page - 1;
        this.nextPage = this.searchState.page + 1;
      } else {
        this.nextPage = 2;
        this.searchState.page = 1;
      }

      if (queryParams[sortParam]) {
        this.searchState.sort = queryParams[sortParam];
      } else {
        this.searchState.sort = sortParamRank;
      }

      if (queryParams[filterParam]) {
        this.searchState.filter = queryParams[filterParam];
      } else {
        this.searchState.filter = "";
      }
      this.execSearch(initial);
    });
  }

  execSearch(initial: boolean, reset?: { podcasts?: boolean, subjects?: boolean }) {
    var sort: string = "";

    if (this.searchState.sort == "date-asc") {
      sort = "release asc";
    } else if (this.searchState.sort == "date-desc") {
      sort = "release desc";
    }
    this.oDataService.getEntitiesWithFacets<SearchResult>(
      new URL("/search", environment.api).toString(),
      {
        search: this.searchState.query,
        filter: this.buildFilter(
          this.searchState.filter,
          this.podcastsFilter,
          this.subjectsFilter),
        searchMode: 'any',
        queryType: 'simple',
        count: true,
        skip: this.infiniteScrollStrategy.getSkip(this.searchState.page),
        top: this.infiniteScrollStrategy.getTake(this.searchState.page),
        facets: ["podcastName,count:1000,sort:count", "subjects,count:1000,sort:count"],
        orderby: sort
      }).subscribe({
        next: data => {
          const count: number = data.metadata.get("count");
          if (data.entities.length && !this.results().length) {
            this.scrollDisplatcher.scrolled().subscribe(async () => {
              if (this.results().length < count &&
                this.isScrolledToBottom() &&
                !this.isSubsequentLoading()) {
                this.isSubsequentLoading.set(true);
                this.searchState.page++;
                this.execSearch(false);
              }
            });
          }
          if (initial) {
            this.results.set(data.entities);
          } else {
            this.results.update(v => v.concat(data.entities));
          }
          this.isSubsequentLoading.set(false);
          if (initial) {
            this.facets = {
              podcastName: data.facets.podcastName,
              subjects: data.facets.subjects?.filter(x => !x.value.startsWith("_"))
            };
          } else {
            if (reset?.podcasts) {
              this.facets.podcastName = data.facets.podcastName;
            }
            if (reset?.subjects) {
              this.facets.subjects = data.facets.subjects;
            }
          }
          let resultsSummary: String = `${count} results`;
          if (count === 0) {
            resultsSummary = `0 results`;
          } else if (count === 1) {
            resultsSummary = `1 result`;
          }

          let presentableQuery: string = this.searchState.query;
          if ((presentableQuery.startsWith("'") && presentableQuery.endsWith("'")) ||
            (presentableQuery.startsWith("\"") && presentableQuery.endsWith("\""))) {
            presentableQuery = presentableQuery.substring(1, presentableQuery.length - 1);
          }

          this.resultsHeading = `Found ${resultsSummary} for "${presentableQuery}"`;
          this.isLoading = false;
        },
        error: (e) => {
          console.error(e);
          this.resultsHeading = "Something went wrong. Please try again.";
          this.isLoading = false;
        }
      });
  }

  setSort(sort: string) {
    var url = `/search/${this.searchState.query}`;
    var params: Params = {};
    if (sort != sortParamRank) {
      params[sortParam] = sort;
    }
    this.router.navigate([url], { queryParams: params });
  }

  podcastsChange($event: MatChipListboxChange) {
    const delimiter = '£';
    var items: { count: number, value: string }[] = $event.value;
    this.podcasts = items.map(x => x.value.replaceAll("'", "''"));
    if (this.podcasts.length == 0) {
      this.podcastsFilter = "";
    } else {
      var podcastsNameList = this.podcasts.join(delimiter);
      this.podcastsFilter = `search.in(podcastName, '${podcastsNameList}', '${delimiter}')`;
    }
    const reset = { subjects: true };
    this.searchState.page = 1;
    this.execSearch(true, reset);
  }

  subjectsChange($event: MatChipListboxChange) {
    const delimiter = '£';
    var items: { count: number, value: string }[] = $event.value;
    this.subjects = items.map(x => x.value.replaceAll("'", "''"));
    if (this.subjects.length == 0) {
      this.subjectsFilter = "";
    } else {
      var subjectsameList = this.subjects.join(delimiter);
      this.subjectsFilter = `subjects/any(s: search.in(s, '${subjectsameList}', '${delimiter}'))`;
    }
    const reset = { podcasts: true };
    this.searchState.page = 1;
    this.execSearch(true, reset);
  }

  isScrolledToBottom(): boolean {
    const scrollPosition = window.scrollY + window.innerHeight;
    const threshold = document.documentElement.scrollHeight - this.infiniteScrollStrategy.getYThreshold(this.searchState.page);
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

