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
  title = 'cultpodcasts';

  search= (input:HTMLInputElement) => {
    input.blur();
    this.isLoading= true;
    let url= "https://api.cultpodcasts.com/api/episode_search/"+encodeURIComponent(input.value);
    this.http.get(url)
      .subscribe(data => {
        this.results= data;
        this.isLoading= false;
      }, error=>{this.isLoading= false});
  };
}

