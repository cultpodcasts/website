import { Component, inject } from '@angular/core';
import { ISearchResult } from '../ISearchResult';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Data, NavigationExtras, Params, QueryParamsHandling, Router } from '@angular/router';
import { combineLatest } from 'rxjs/internal/observable/combineLatest';
import { SiteService } from '../SiteService';

const pageSize:number = 20;
const sortParamRank:string = "rank";
const sortParam:string = "sort";
const sortParamDateAsc:string = "date-asc";
const sortParamDateDesc:string = "date-desc";
const pageParam:string = "page";
const queryParam:string = "query";

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.sass']
})

export class SearchComponent {
  query: string="";
  prevPage: number=0;
  nextPage: number=0;
  page:number|undefined;
  sortMode: string=sortParamRank;
  
  sortParamRank: string= sortParamRank;
  sortParamDateAsc: string = sortParamDateAsc;
  sortParamDateDesc : string = sortParamDateDesc;

  constructor(private http: HttpClient, private router: Router, private siteService: SiteService) {
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
      this.query= params[queryParam];
      this.siteService.setQuery(this.query);

      if (queryParams[pageParam]) {
        this.page= parseInt(queryParams[pageParam]);
        this.prevPage= this.page - 1;
        this.nextPage=  this.page + 1;
      } else {
        this.nextPage= 2;
        this.page= undefined;
      }

      if (queryParams[sortParam]) {
        this.sortMode= queryParams[sortParam];
      } else {
        this.sortMode= sortParamRank;
      }

      let inQueryString:boolean= false;
      let url= "https://api.cultpodcasts.com/api/episode_search/"+encodeURIComponent(this.query);
      if (this.page) {
        url+= `?page=${this.page}`;
        inQueryString= true;
      }
      if (this.sortMode!=sortParamRank) {
        url+= inQueryString?"&":"?";
        url+=`order=`;
        if (this.sortMode==sortParamDateAsc) {
          url+="date";
        } else {
          url+= "date-desc";
        }
      }

      let currentTime= Date.now();
      this.http.get<ISearchResult[]>(url)
        .subscribe(data => {
          this.results= data;
          var requestTime= (Date.now() - currentTime)/1000;
          if (this.results.length===0) {
            this.resultsHeading= `Found 0 results for "${this.query}". Time taken ${requestTime.toFixed(1)}s.`;
          } else if (this.results.length===1) {
            this.resultsHeading= `Found 1 result for "${this.query}". Time taken ${requestTime.toFixed(1)}s.`;
          } else if (this.results.length==pageSize) {
            this.resultsHeading= `Found ${this.results.length}+ results for "${this.query}". Time taken ${requestTime.toFixed(1)}s.`;
          } else {
            this.resultsHeading= `Found ${this.results.length} results for "${this.query}". Time taken ${requestTime.toFixed(1)}s.`;
          } 
          this.isLoading= false;
          this.showPagingPrevious= this.page!=undefined && this.page > 2;
          this.showPagingPreviousInit= this.page!=undefined && this.page == 2;
          this.showPagingNext= this.results.length==pageSize;
        }, error=>{
          this.resultsHeading= "Something went wrong. Please try again.";
          this.isLoading= false;
        });
    });
  }

  setSort(sort: string) {
    var url= `/search/${this.query}`;
    var inQueryString= false;
    this.sortMode= sort;
    if (sort!=sortParamRank) {
      if (inQueryString) {
        url+="&";
      } else {
        url+="?";
      }
      url+=`${sortParam}=${sort}`;
    }
    this.router.navigateByUrl(url)
  }    
}
