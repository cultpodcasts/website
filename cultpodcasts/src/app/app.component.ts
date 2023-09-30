import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {MatAccordion, MatExpansionModule} from '@angular/material/expansion';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import { IHomepage } from './IHomepage';
import { ISearchResult } from './ISearchResult';
import { HomeComponent } from './home/home.component';
import { SearchComponent } from './search/search.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.sass'],
})

export class AppComponent {
  isLoading= false;
  constructor(private http: HttpClient) {}

  results: any;
  homepage: IHomepage|undefined;
  totalDuration: string="";
  title = 'cultpodcasts';
  resultsHeading: string= "";
  searched: boolean= false;

  ngOnInit() {
    let homepage= this.http.get<IHomepage>("https://api.cultpodcasts.com/api/homepage")
      .subscribe(data=>{
        this.homepage= data;
        this.totalDuration= data.totalDuration.split(".")[0]+" days";
      });
  }

  search= (input:HTMLInputElement) => {
    input.blur();
    this.isLoading= true;
    let url= "https://api.cultpodcasts.com/api/episode_search/"+encodeURIComponent(input.value);
    let currentTime= Date.now();
    this.searched= true;
    this.http.get<ISearchResult[]>(url)
      .subscribe(data => {
        this.results= data;
        this.isLoading= false;
        var requestTime= (Date.now() - currentTime)/1000;
        if (this.results.length===0) {
          this.resultsHeading= "0 Results. Time taken "+requestTime+" seconds."
        } else if (this.results.length===1) {
          this.resultsHeading= "1 Result. Time taken "+requestTime+" seconds."
        } else {
          this.resultsHeading= this.results.length+" Results. Time taken "+requestTime+" seconds."
        } 
      }, error=>{
        this.isLoading= false;
        this.resultsHeading= "Something went wrong. Please try again.";
      });
  };
}
