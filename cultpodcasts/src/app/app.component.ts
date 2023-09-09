import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.sass']
})
export class AppComponent {
  constructor(private http: HttpClient) {}

  results: any;
  title = 'cultpodcasts';

  search= (searchTerm:string) => {
    let url= "https://api.cultpodcasts.com/api/episode_search/"+encodeURIComponent(searchTerm);
    this.http.get(url)
      .subscribe(data => {
        this.results= data;
      });
  };
}

