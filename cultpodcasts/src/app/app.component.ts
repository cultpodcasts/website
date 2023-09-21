import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {MatAccordion, MatExpansionModule} from '@angular/material/expansion';
import {MatProgressBarModule} from '@angular/material/progress-bar';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.sass'],
})

export class AppComponent {
  isLoading= false;
  constructor(private http: HttpClient) {}

  results: any;
  homepage: any;
  title = 'cultpodcasts';
  resultsHeading: string= "";
  searched: boolean= false;

  ngOnInit() {
    this.isLoading= true;
    let homepage= this.http.get("https://api.cultpodcasts.com/api/homepage")
      .subscribe(data=>{
        this.homepage= data;
      });
    this.isLoading= false;
  }

  search= (input:HTMLInputElement) => {
    input.blur();
    this.isLoading= true;
    let url= "https://api.cultpodcasts.com/api/episode_search/"+encodeURIComponent(input.value);
    let currentTime= Date.now();
    this.searched= true;
    this.http.get(url)
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
      }, error=>{this.isLoading= false});
  };
}

