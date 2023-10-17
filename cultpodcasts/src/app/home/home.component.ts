import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IHomepage } from '../IHomepage';
import { SiteService } from '../SiteService';
import { IHomepageItem } from '../IHomepageItem';
import { KeyValue } from '@angular/common';


@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.sass']
})
export class HomeComponent {
  grouped: { [key: string]: IHomepageItem[]; } ;
  constructor(private http: HttpClient, private siteService: SiteService) {
    this.grouped= {};
  }

  Weekday = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
  Month = ["January","February","March","April","May","June","July", "August", "September", "October", "November", "December"]

  ToDate = (dateStr:string) => {
    const [day, month, year] = dateStr.split("/")
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  }

  descDate = (a: KeyValue<string, IHomepageItem[]>, b: KeyValue<string, IHomepageItem[]>):number => {

    var aD= this.ToDate(a.key);
    var bD= this.ToDate(b.key);
    if (aD > bD) {
      return -1;
    }
    if (aD < bD) {
      return 1
    }
    return 0;
  }

 homepage: IHomepage|undefined;
  totalDuration: string="";

  ngOnInit() {
    this.siteService.setQuery("");
    let homepage= this.http.get<IHomepage>("https://api.cultpodcasts.com/homepage")
      .subscribe(data=>{
        this.homepage= data;
        this.totalDuration= data.totalDuration.split(".")[0]+" days";
        this.grouped= data.recentEpisodes.reduce((group: {[key: string]: IHomepageItem[]}, item)=>{
          item.release= new Date(item.release);
          if (!group[item.release.toLocaleDateString()]) {
            group[item.release.toLocaleDateString()] = [];
           }
           group[item.release.toLocaleDateString()].push(item);
           return group;
        }, {});
    });
  }
}
