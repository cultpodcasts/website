import { Component, inject } from '@angular/core';
import { ISearchResult } from '../ISearchResult';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { combineLatest } from 'rxjs/internal/observable/combineLatest';
import { SiteService } from '../SiteService';
import { ISearchState } from '../ISearchState';
import { ODataService } from '../OdataService'
import { environment } from './../../environments/environment';

const pageSize: number = 10;

const sortParam: string = "sort";
const pageParam: string = "page";
const queryParam: string = "query";
const filterParam: string = "filter";

const sortParamRank: string = "rank";
const sortParamDateAsc: string = "date-asc";
const sortParamDateDesc: string = "date-desc";

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.sass']
})

export class SearchComponent {
  searchState: ISearchState = {
    query: "",
    episodeUuid: "",
    page: 1,
    sort: sortParamRank,
    filter: null
  }

  prevPage: number = 0;
  nextPage: number = 0;

  sortParamRank: string = sortParamRank;
  sortParamDateAsc: string = sortParamDateAsc;
  sortParamDateDesc: string = sortParamDateDesc;

  constructor(private router: Router, private siteService: SiteService, private oDataService: ODataService) {
  }
  private route = inject(ActivatedRoute);

  results: ISearchResult[] = [];
  resultsHeading: string = "";
  isLoading: boolean = true;
  showPagingPrevious: boolean = false;
  showPagingNext: boolean = false;

  ngOnInit() {
    combineLatest(
      this.route.params,
      this.route.queryParams,
      (params: Params, queryParams: Params) => ({
        params,
        queryParams,
      })
    ).subscribe((res: { params: Params; queryParams: Params }) => {
      const { params, queryParams } = res;

      this.isLoading = true;
      this.searchState.query = params[queryParam];
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
        this.searchState.filter = null;
      }

      let currentTime = Date.now();

      var sort: string = "";
      if (this.searchState.sort == "date-asc") {
        sort = "release asc";
      } else if (this.searchState.sort == "date-desc") {
        sort = "release desc";
      }

      this.oDataService.getEntities<ISearchResult>(
        new URL("/search", environment.api).toString(),
        {
          search: this.searchState.query,
          filter: this.searchState.filter,
          searchMode: 'any',
          queryType: 'simple',
          count: true,
          skip: (this.searchState.page - 1) * pageSize,
          top: pageSize,
          facets: ["podcastName,count:10,sort:count", "subjects,count:10,sort:count"],
          orderby: sort
        }).subscribe(data => {
          this.results = data.entities;
          var requestTime = (Date.now() - currentTime) / 1000;
          const count = data.metadata.get("count");
          let presentableQuery: string = this.searchState.query;
          if ((presentableQuery.startsWith("'") && presentableQuery.endsWith("'")) ||
            (presentableQuery.startsWith("\"") && presentableQuery.endsWith("\""))) {
            presentableQuery = presentableQuery.substring(1, presentableQuery.length - 1);
          }
          let resultsSummary: String = `${count} results`;
          if (count === 0) {
            resultsSummary = `0 results`;
          } else if (count === 1) {
            resultsSummary = `1 result`;
          }
          this.resultsHeading = `Found ${resultsSummary} for "${presentableQuery}"`;

          this.isLoading = false;
          this.showPagingPrevious = this.searchState.page != undefined && this.searchState.page > 1;
          this.showPagingNext = (this.searchState.page * pageSize) < count;
        }, error => {
          this.resultsHeading = "Something went wrong. Please try again.";
          this.isLoading = false;
        });
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

  setPage(page: number) {
    var url = `/search/${this.searchState.query}`;
    this.searchState.page += page;
    var params: Params = {};
    if (this.searchState.page != null && this.searchState.page > 1) {
      params["page"] = this.searchState.page;
    }
    if (this.searchState.sort != sortParamRank) {
      params[sortParam] = this.searchState.sort;
    }
    this.router.navigate([url], { queryParams: params });

  }
}
