import { Component, Inject, Optional, PLATFORM_ID, inject } from '@angular/core';
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
import { NgIf, NgClass, NgFor, DatePipe, isPlatformBrowser, PlatformLocation, isPlatformServer } from '@angular/common';
import { SeoService } from '../seo.service';
import { GuidService } from '../guid.service';
import { ShortnerRecord } from '../shortner-record';
import { KVNamespace } from '@cloudflare/workers-types';

const pageSize: number = 10;

const sortParam: string = "sort";
const pageParam: string = "page";

const sortParamRank: string = "rank";
const sortParamDateAsc: string = "date-asc";
const sortParamDateDesc: string = "date-desc";

@Component({
  selector: 'app-podcast',
  templateUrl: './podcast.component.html',
  styleUrls: ['./podcast.component.sass'],
  standalone: true,
  imports: [NgIf, MatProgressBarModule, MatButtonModule, MatMenuModule, MatIconModule, NgClass, NgFor, MatCardModule, RouterLink, DatePipe],
  host: { ngSkipHydration: 'true' }
})

export class PodcastComponent {
  searchState: ISearchState = {
    query: "",
    episodeUuid: "",
    page: 1,
    sort: sortParamDateDesc,
    filter: null
  }

  podcastName: string = "";
  count: number = 0;

  prevPage: number = 0;
  nextPage: number = 0;

  sortParamRank: string = sortParamRank;
  sortParamDateAsc: string = sortParamDateAsc;
  sortParamDateDesc: string = sortParamDateDesc;
  isBrowser: any;
  isServer: boolean;

  constructor(
    private router: Router,
    private siteService: SiteService,
    private oDataService: ODataService,
    private guidService: GuidService,
    @Inject(PLATFORM_ID) platformId: any,
    private seoService: SeoService,
    @Optional() @Inject('kv') private kv: KVNamespace
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.isServer = isPlatformServer(platformId);
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

      this.podcastName = params["podcastName"];
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const queryParam = params["query"];
      let query = "";
      let episodeUuid = "";
      let episodeTitle = "";
      if (queryParam) {
        if (uuid.test(queryParam)) {
          episodeUuid = queryParam;
        } else {
          query = queryParam;
        }
      }

      if (this.isServer) {
        if (episodeUuid != "") {
          console.log("episode-uuid: " + episodeUuid);
          const key = this.guidService.toBase64(episodeUuid);
          console.log("key: " + key);
          console.log("kv: " + this.kv);
          try {
            this.kv.getWithMetadata<ShortnerRecord>(key).then(episodeKvWithMetaData => {
              console.log("episodeKvWithMetaData: " + episodeKvWithMetaData);
              if (episodeKvWithMetaData != null && episodeKvWithMetaData.metadata != null) {
                episodeTitle = episodeKvWithMetaData.metadata.episodeTitle;
                console.log("episodeTitle: " + episodeTitle);
                if (episodeTitle != "") {
                  this.seoService.AddMetaTags({ title: episodeTitle, description: this.podcastName });
                } else {
                  this.seoService.AddMetaTags({ title: this.podcastName });
                }
                this.populatePage(query, episodeUuid, queryParams)
              } else {
                this.seoService.AddMetaTags({ title: this.podcastName });
                this.populatePage(query, episodeUuid, queryParams)
              }
            },
              failure => {
                this.populatePage(query, episodeUuid, queryParams)
              });
          } catch (error) {
            console.log(error);
            console.error(error);
            this.seoService.AddMetaTags({ title: this.podcastName });
          }
        }
      }
      console.log("Finished pre-processing");

    });
  }

  populatePage(query: string, episodeUuid: string, queryParams: Params) {
    this.isLoading = true;

    this.searchState.query = query;
    this.siteService.setQuery(this.searchState.query);
    this.searchState.episodeUuid = episodeUuid;
    this.siteService.setEpisodeUuid(this.searchState.episodeUuid);

    this.siteService.setPodcast(this.podcastName);
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
      if (this.searchState.query) {
        this.searchState.sort = sortParamRank;
      } else {
        this.searchState.sort = sortParamDateDesc;
      }
    }

    this.searchState.filter = `(podcastName eq '${this.podcastName.replaceAll("'", "''")}')`;
    if (this.searchState.episodeUuid) {
      this.searchState.filter += ` and (id eq '${this.searchState.episodeUuid}')`;
    }
    this.siteService.setFilter(this.searchState.filter);

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
        this.count = count;
        this.isLoading = false;
        this.showPagingPrevious = this.searchState.page != undefined && this.searchState.page > 1;
        this.showPagingNext = (this.searchState.page * pageSize) < count;
      }, error => {
        this.resultsHeading = "Something went wrong. Please try again.";
        this.isLoading = false;
      });
  }

  setSort(sort: string) {
    var url = `/podcast/${this.podcastName}`;
    var query = this.siteService.getSiteData().query;
    if (query && query != "") {
      url = `${url}/${query}`;
    }
    var params: Params = {};
    if (this.searchState.query) {
      if (sort != sortParamRank) {
        params[sortParam] = sort;
      }
    } else {
      if (sort != sortParamDateDesc) {
        params[sortParam] = sort;
      }
    }
    this.router.navigate([url], { queryParams: params });
  }

  setPage(page: number) {
    var url = `/podcast/${this.podcastName}`;
    if (this.searchState.query && this.searchState.query != "") {
      url += "/" + this.searchState.query;
    }
    this.searchState.page += page;
    var params: Params = {};
    if (this.searchState.page != null && this.searchState.page > 1) {
      params["page"] = this.searchState.page;
    }
    if (this.searchState.query) {
      if (this.searchState.sort != sortParamRank) {
        params[sortParam] = this.searchState.sort;
      }
    } else {
      if (this.searchState.sort != sortParamDateDesc) {
        params[sortParam] = this.searchState.sort;
      }
    }
    this.router.navigate([url], { queryParams: params });
  }

  search() {
    let url = `search/${this.podcastName}`;
    if (this.searchState.query) {
      url += ` ${this.searchState.query}`;
    }
    this.router.navigate([url]);
  }
}
