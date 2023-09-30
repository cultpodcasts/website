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
  constructor(private http: HttpClient) {}
  private activatedRoute = inject(ActivatedRoute);
  
  results: any;
  resultsHeading: string= "";
  isLoading: boolean= true;

  ngOnInit() {
    this.activatedRoute.params.subscribe(({query}) =>{
      this.isLoading= true;
      let url= "https://api.cultpodcasts.com/api/episode_search/"+encodeURIComponent(query);
      let currentTime= Date.now();
      this.http.get<ISearchResult[]>(url)
        .subscribe(data => {
          this.results= data;
          var requestTime= (Date.now() - currentTime)/1000;
          if (this.results.length===0) {
            this.resultsHeading= "0 Results. Time taken "+requestTime+" seconds."
          } else if (this.results.length===1) {
            this.resultsHeading= "1 Result. Time taken "+requestTime+" seconds."
          } else {
            this.resultsHeading= this.results.length+" Results. Time taken "+requestTime+" seconds."
          } 
          this.isLoading= false;
        }, error=>{
          this.resultsHeading= "Something went wrong. Please try again.";
          this.isLoading= false;
        });
    });


  }
}
