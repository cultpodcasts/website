import { Component, inject } from '@angular/core';
import { ISearchResult } from '../ISearchResult';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs/internal/observable/combineLatest';
import { SiteService } from '../SiteService';
import { ISearchState } from '../ISearchState';
import { ODataService } from '../OdataService'
import { environment } from './../../environments/environment';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { NgIf, NgClass, NgFor, DatePipe, formatDate } from '@angular/common';
import { GuidService } from '../guid.service';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatChipListbox, MatChipListboxChange, MatChipOption } from '@angular/material/chips';
import { SearchResultsFacets } from '../search-results-facets';
import { FacetState } from '../facet-state';

const pageSize: number = 20;

const sortParam: string = "sort";
const pageParam: string = "page";
const queryParam: string = "query";
const filterParam: string = "filter";

const sortParamRank: string = "rank";
const sortParamDateAsc: string = "date-asc";
const sortParamDateDesc: string = "date-desc";

@Component({
  selector: 'app-search-api',
  standalone: true,
  imports: [
    NgIf,
    MatProgressBarModule,
    MatButtonModule,
    MatMenuModule,
    MatIconModule,
    NgClass,
    NgFor,
    MatCardModule,
    RouterLink,
    DatePipe,
    MatExpansionModule,
    MatChipListbox,
    MatChipOption
  ],
  templateUrl: './search-api.component.html',
  styleUrl: './search-api.component.sass'
})

export class SearchApiComponent {
  searchState: ISearchState = {
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

  results: ISearchResult[] = [];
  resultsHeading: string = "";
  isLoading: boolean = true;
  showPagingPrevious: boolean = false;
  showPagingNext: boolean = false;
  facets: SearchResultsFacets = {};
  subjects: string[] = [];
  podcasts: string[] = [];
  subjectsFilter: string = "";
  podcastsFilter: string = "";

  constructor(
    private router: Router,
    private siteService: SiteService,
    private oDataService: ODataService,
    private guidService: GuidService) {
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
      let reset: { podcasts?: boolean, subjects?: boolean } | undefined;
      let initial = true;
      if (navigation) {
        const facetState = navigation.extras.state as FacetState;
        if (facetState) {
          initial = false;
          this.facets = facetState.searchResultsFacets;
          if (!facetState.resetPodcasts) {
            this.podcasts = facetState.podcasts!;
          } else {
            if (!reset) {
              reset = {};
            }
            reset.podcasts = true;
          }
          if (!facetState.resetSubjects) {
            this.subjects = facetState.subjects!;
          } else {
            if (!reset) {
              reset = {};
            }
            reset.subjects = true;
          }
        }
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
      this.execSearch(initial, reset);
    });
  }

  execSearch(initial: boolean, reset?: { podcasts?: boolean, subjects?: boolean }) {
    var sort: string = "";
    if (this.searchState.sort == "date-asc") {
      sort = "release asc";
    } else if (this.searchState.sort == "date-desc") {
      sort = "release desc";
    }

    this.oDataService.getEntitiesWithFacets<ISearchResult>(
      new URL("/search", environment.api).toString(),
      {
        search: this.searchState.query,
        filter: buildFilter(
          this.searchState.filter,
          this.podcastsFilter,
          this.subjectsFilter),
        searchMode: 'any',
        queryType: 'simple',
        count: true,
        skip: (this.searchState.page - 1) * pageSize,
        top: pageSize,
        facets: ["podcastName,count:1000,sort:count", "subjects,count:1000,sort:count"],
        orderby: sort
      }).subscribe({
        next: data => {
          this.results = data.entities;
          if (initial) {
            this.facets = {
              podcastName: data.facets.podcastName,
              subjects: data.facets.subjects?.filter(x => !x.value.startsWith("_"))
            };
          } else {
            if (reset && reset.podcasts) {
              this.facets.podcastName = data.facets.podcastName;
            }
            if (reset && reset.subjects) {
              this.facets.subjects = data.facets.subjects;
            }
          }
          const count = data.metadata.get("count");
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
          this.showPagingPrevious = this.searchState.page != undefined && this.searchState.page > 1;
          this.showPagingNext = (this.searchState.page * pageSize) < count;
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

  setPage(page: number, reset?: { podcasts?: boolean, subjects?: boolean }) {
    var url = `/search/${this.searchState.query}`;
    this.searchState.page += page;
    var params: Params = {};
    if (this.searchState.page != null && this.searchState.page > 1) {
      params["page"] = this.searchState.page;
    }
    if (this.searchState.sort != sortParamRank) {
      params[sortParam] = this.searchState.sort;
    }
    const facetState: FacetState = {
      searchResultsFacets: this.facets,
      podcasts: this.podcasts,
      subjects: this.subjects,
      resetPodcasts: reset?.podcasts,
      resetSubjects: reset?.subjects,
    };
    this.router.navigate([url], { queryParams: params, state: facetState });
  }

  share(item: ISearchResult) {
    let description = `"${item.episodeTitle}" - ${item.podcastName}`;
    description = description + ", " + formatDate(item.release, 'mediumDate', 'en-US');
    description = description + " [" + item.duration.split(".")[0].substring(1) + "]";
    const shortGuid = this.guidService.toBase64(item.id);
    const share = {
      title: item.episodeTitle,
      text: description,
      url: `${environment.shortner}/${shortGuid}`
    };
    window.navigator.share(share);
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
    if (this.searchState.page > 1) {
      this.setPage(1 - this.searchState.page, reset);
    }
    else {
      this.execSearch(false, reset);
    }
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
    if (this.searchState.page > 1) {
      this.setPage(1 - this.searchState.page, reset);
    }
    else {
      this.execSearch(false, reset);
    }
  }
}

function buildFilter(baseFilter: string | null, podcastsFilter: string, subjectsFilter: string): string {
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

