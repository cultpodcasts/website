import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IHomepage } from '../IHomepage';
import { SiteService } from '../SiteService';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.sass']
})
export class HomeComponent {
  constructor(private http: HttpClient, private siteService: SiteService) {}

  homepage: IHomepage|undefined;
  totalDuration: string="";

  ngOnInit() {
    this.siteService.setQuery("");
    let homepage= this.http.get<IHomepage>("https://api.cultpodcasts.com/api/homepage")
      .subscribe(data=>{
        this.homepage= data;
        this.totalDuration= data.totalDuration.split(".")[0]+" days";
      });
  }
}
