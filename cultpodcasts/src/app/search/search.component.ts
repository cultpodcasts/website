import { Component, inject } from '@angular/core';
import { ISearchResult } from '../ISearchResult';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Data, Params, Router } from '@angular/router';
import { combineLatest } from 'rxjs/internal/observable/combineLatest';

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
  sortMode: string="rank";
  constructor(private http: HttpClient, private router: Router) {}
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
      this.route.data,
      (params: Params, data: Data) => ({
        params,
        data,
      })
    ).subscribe((res: { params: Params; data: Data }) => {
      const { params, data} = res;

      this.isLoading= true;
      this.query= params["query"];

      if (params["page"]) {
        this.page= parseInt(params["page"]);
        this.prevPage= this.page - 1;
        this.nextPage=  this.page + 1;
      } else {
        this.nextPage= 2;
        this.page= undefined;
      }

      if (params["sort"]) {
        this.sortMode= params["sort"];
        console.log(`Sort=${this.sortMode}`);
      }

      let inQueryString:boolean= false;
      let url= "https://api.cultpodcasts.com/api/episode_search/"+encodeURIComponent(this.query);
      if (this.page) {
        url+= `?page=${this.page}`;
        inQueryString= true;
      }
      if (this.sortMode!="rank") {
        url+= inQueryString?"&":"?";
        url+=`order=`;
        if (this.sortMode=="dateasc") {
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
            this.resultsHeading= `Found 0 results for "${this.query}". Time taken ${requestTime} seconds.`;
          } else if (this.results.length===1) {
            this.resultsHeading= `Found 1 result for "${this.query}". Time taken ${requestTime} seconds.`;
          } else {
            this.resultsHeading= `Found ${this.results.length} results for "${this.query}". Time taken ${requestTime} seconds.`;
          } 
          this.isLoading= false;
          this.showPagingPrevious= this.page!=undefined && this.page > 2;
          this.showPagingPreviousInit= this.page!=undefined && this.page == 2;
          this.showPagingNext= this.results.length==100;
        }, error=>{
          this.resultsHeading= "Something went wrong. Please try again.";
          this.isLoading= false;
        });
    });
  }

  setSort(sort: string) {
    var url= `/search/${this.query}`;
    if (this.page && this.page>1) {
      url+=`;page=${this.page}`;
    }
    url+=`;sort=${sort}`;
    this.router.navigateByUrl(url)
  }    
}
