import { Component, inject } from '@angular/core';
import { ISearchResult } from '../ISearchResult';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Data, NavigationExtras, Params, QueryParamsHandling, Router } from '@angular/router';
import { combineLatest } from 'rxjs/internal/observable/combineLatest';
import { SiteService } from '../SiteService';
import { ISearchState } from '../ISearchState';
import { ODataService } from '../OdataService'
const pageSize:number = 10;

const sortParam:string = "sort";
const pageParam:string = "page";
const queryParam:string = "query";
const filterParam:string = "filter";

const sortParamDateAsc:string = "date-asc";
const sortParamDateDesc:string = "date-desc";

@Component({
  selector: 'app-podcast',
  templateUrl: './podcast.component.html',
  styleUrls: ['./podcast.component.sass']
})

export class PodcastComponent {
  searchState:ISearchState= {
    query:"",
    page:1,
    sort:sortParamDateDesc,
    filter:null
  }

  podcastName: string="";
  count: number=0;

  prevPage: number=0;
  nextPage: number=0;
  
  sortParamRank: string= sortParamDateDesc;
  sortParamDateAsc: string = sortParamDateAsc;
  sortParamDateDesc : string = sortParamDateDesc;

  constructor(private http: HttpClient, private router: Router, private siteService: SiteService, private oDataService: ODataService) {
  }
  private route = inject(ActivatedRoute);
  
  results: any;
  resultsHeading: string= "";
  isLoading: boolean= true;
  showPagingPrevious:boolean=false;
  showPagingPreviousInit: boolean= false;
  showPagingNext:boolean=false;

  ngOnInit() {
    combineLatest(
      this.route.params,
      this.route.queryParams,
      (params: Params, queryParams: Params) => ({
        params,
        queryParams,
      })
    ).subscribe((res: { params: Params; queryParams: Params }) => {
      const { params, queryParams} = res;

      this.isLoading= true;
      this.searchState.query= "";
      this.siteService.setQuery(this.searchState.query);

      if (queryParams[pageParam]) {
        this.searchState.page= parseInt(queryParams[pageParam]);
        this.prevPage= this.searchState.page - 1;
        this.nextPage=  this.searchState.page + 1;
      } else {
        this.nextPage= 2;
        this.searchState.page= 1;
      }

      if (queryParams[sortParam]) {
        this.searchState.sort= queryParams[sortParam];
      } else {
        this.searchState.sort= sortParamDateDesc;
      }

      this.podcastName= params["podcastName"]
        .replaceAll("'", "''");

      this.searchState.filter= `(podcastName eq '${this.podcastName}')`;
      this.siteService.setFilter(this.searchState.filter);

      let currentTime= Date.now();
      var sort: string= "";
      if (this.searchState.sort=="date-asc") {
        sort= "release asc";
      } else if (this.searchState.sort=="date-desc") {
        sort= "release desc";
      }

      this.oDataService.getEntities<ISearchResult>(
        'https://api.cultpodcasts.com/api/?',
        {
          search: this.searchState.query,
          filter: this.searchState.filter,
          searchMode: 'any',
          queryType: 'simple',
          count: true,
          skip:(this.searchState.page-1) * pageSize,
          top: pageSize,
          facets: ["podcastName,count:10,sort:count", "subjects,count:10,sort:count"],
          orderby: sort
        }).subscribe(data=>{
          this.results= data.entities;
          var requestTime= (Date.now() - currentTime)/1000;
          const count= data.metadata.get("count");

          this.count= count;

          this.isLoading= false;
          this.showPagingPrevious= this.searchState.page!=undefined && this.searchState.page > 2;
          this.showPagingPreviousInit= this.searchState.page!=undefined && this.searchState.page == 2;
          this.showPagingNext= (this.searchState.page * pageSize) < count;
        }, error=>{
          this.resultsHeading= "Something went wrong. Please try again.";
          this.isLoading= false;
        });
    });
  }

  setSort(sort: string) {
    var url= `/podcast/${this.podcastName}`;
    var params:Params= {};
    if (sort!=sortParamDateDesc) {
      params[sortParam]= sort;
    }
    this.router.navigate([url], {queryParams:params} );
  }    
  
  setPage(page:number){
    var url= `/podcast/${this.podcastName}`;
    this.searchState.page+= page;
    var params:Params= {};
    if (this.searchState.page!=null && this.searchState.page > 1) {
      params["page"]= this.searchState.page;
    }
    if (this.searchState.sort!=sortParamDateDesc) {
      params[sortParam]= this.searchState.sort;
    }
    this.router.navigate([url], {queryParams:params} );

  }
}
