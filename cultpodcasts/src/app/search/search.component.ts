import { Component, inject } from '@angular/core';
import { ISearchResult } from '../ISearchResult';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Data, NavigationExtras, Params, QueryParamsHandling, Router } from '@angular/router';
import { combineLatest } from 'rxjs/internal/observable/combineLatest';
import { SiteService } from '../SiteService';
import { ISearchState } from '../ISearchState';
import { ODataService } from '../OdataService'
const pageSize:number = 20;

const sortParam:string = "sort";
const pageParam:string = "page";
const queryParam:string = "query";

const sortParamRank:string = "rank";
const sortParamDateAsc:string = "date-asc";
const sortParamDateDesc:string = "date-desc";

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.sass']
})

export class SearchComponent {
  searchState:ISearchState= {
    query:"",
    page:1,
    sort:sortParamRank
  }

  prevPage: number=0;
  nextPage: number=0;
  
  sortParamRank: string= sortParamRank;
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
      this.searchState.query= params[queryParam];
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
        this.searchState.sort= sortParamRank;
      }

      let currentTime= Date.now();
      this.oDataService.getEntities<ISearchResult>(
        'https://cultpodcasts.search.windows.net/indexes/cosmosdb-index/docs/search?api-version=2016-09-01',
        {
          search: this.searchState.query,
          searchMode: 'any',
          queryType: 'simple',
          count: true,
          skip:(this.searchState.page-1) * pageSize,
          top: pageSize,
          facets: ["podcastName,count:10,sort:count"]
        },
        'TBapMt2RTuulXdyMMICzPK5Jk2HyHNUXKhWX9Sex9IAzSeBS5J1Z').subscribe(data=>{
          this.results= data.entities;
          var requestTime= (Date.now() - currentTime)/1000;
          const count= data.metadata.get("count");
          if (count===0) {
            this.resultsHeading= `Found 0 results for "${this.searchState.query}". Time taken ${requestTime.toFixed(1)}s.`;
          } else if (count===1) {
            this.resultsHeading= `Found 1 result for "${this.searchState.query}". Time taken ${requestTime.toFixed(1)}s.`;
          } else {
            this.resultsHeading= `Found ${count} results for "${this.searchState.query}". Time taken ${requestTime.toFixed(1)}s.`;
          } 
          this.isLoading= false;
          this.showPagingPrevious= this.searchState.page!=undefined && this.searchState.page > 2;
          this.showPagingPreviousInit= this.searchState.page!=undefined && this.searchState.page == 2;
          this.showPagingNext= this.results.length==pageSize;
        }, error=>{
          this.resultsHeading= "Something went wrong. Please try again.";
          this.isLoading= false;
        });
    });
  }

  setSort(sort: string) {
    var url= `/search/${this.searchState.query}`;
    var params:Params= {};
    if (sort!=sortParamRank) {
      params[sortParam]= sort;
    }
    this.router.navigate([url], {queryParams:params} );
  }    
  
  setPage(page:number){
    var url= `/search/${this.searchState.query}`;
    this.searchState.page+= page;
    var params:Params= {};
    if (this.searchState.page!=null && this.searchState.page > 1) {
      params["page"]= this.searchState.page;
    }
    if (this.searchState.sort!=sortParamRank) {
      params[sortParam]= this.searchState.sort;
    }
    this.router.navigate([url], {queryParams:params} );

  }
}
