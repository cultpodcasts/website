import { Component, inject } from '@angular/core';
import { ISearchResult } from '../ISearchResult';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.sass']
})

export class SearchComponent {
  query: string="";
  order: string|undefined;
  prevPage: number=0;
  nextPage: number=0;
  constructor(private http: HttpClient) {}
  private activatedRoute = inject(ActivatedRoute);
  
  results: any;
  resultsHeading: string= "";
  isLoading: boolean= true;
  showPagingPrevious:boolean=false;
  showPagingNext:boolean=false;

  ngOnInit() {
    this.activatedRoute.params.subscribe(({query, page, order}) =>{
      this.isLoading= true;
      this.query= query;
      if (!page) {
        page= 1;
      }

      if (page) {
        this.prevPage= parseInt(page) - 1;
        this.nextPage=  parseInt(page) + 1;
      }

      this.order= order;
      let url= "https://api.cultpodcasts.com/api/episode_search/"+encodeURIComponent(query);
      if (page && parseInt(page)>1) {
        url= url+"?page="+parseInt(page);
      }
      let currentTime= Date.now();
      this.http.get<ISearchResult[]>(url)
        .subscribe(data => {
          this.results= data;
          var requestTime= (Date.now() - currentTime)/1000;
          if (this.results.length===0) {
            this.resultsHeading= `Found 0 results for "${query}". Time taken ${requestTime} seconds.`;
          } else if (this.results.length===1) {
            this.resultsHeading= `Found 1 result for "${query}". Time taken ${requestTime} seconds.`;
          } else {
            this.resultsHeading= `Found ${this.results.length} results for "${query}". Time taken ${requestTime} seconds.`;
          } 
          this.isLoading= false;
          this.showPagingPrevious= page > 1;
          this.showPagingNext= this.results.length==100;
        }, error=>{
          this.resultsHeading= "Something went wrong. Please try again.";
          this.isLoading= false;
        });
    });
  }
}
