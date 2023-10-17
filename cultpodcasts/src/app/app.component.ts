import { Component, ElementRef, ViewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { MatIconRegistry } from "@angular/material/icon";
import { DomSanitizer } from "@angular/platform-browser";
import { SiteService } from './SiteService';
import { ISiteData } from './ISiteData';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.sass'],
})

export class AppComponent {
  siteData: ISiteData= {
    query: "",
    filter:null
  };

  @ViewChild('searchBox', { static: true }) searchBox: ElementRef|undefined;
  
  constructor(private http: HttpClient, private router: Router, private iconRegistry:MatIconRegistry,
    private domSanitizer: DomSanitizer, private siteService: SiteService) {
    this.iconRegistry.addSvgIcon(`reddit`, this.domSanitizer.bypassSecurityTrustResourceUrl("../assets/reddit.svg"));
    this.iconRegistry.addSvgIcon(`twitter`, this.domSanitizer.bypassSecurityTrustResourceUrl("../assets/twitter.svg"));
    this.iconRegistry.addSvgIcon(`github`, this.domSanitizer.bypassSecurityTrustResourceUrl("../assets/github.svg"));
    this.iconRegistry.addSvgIcon(`spotify`, this.domSanitizer.bypassSecurityTrustResourceUrl("../assets/spotify.svg"));
    this.iconRegistry.addSvgIcon(`youtube`, this.domSanitizer.bypassSecurityTrustResourceUrl("../assets/youtube.svg"));
    this.iconRegistry.addSvgIcon(`apple-podcasts`, this.domSanitizer.bypassSecurityTrustResourceUrl("../assets/apple-podcasts.svg"));
  }

  ngOnInit() {
    this.siteService.currentSiteData.subscribe(siteData => {
      if (this.searchBox) {
        this.searchBox.nativeElement.value= siteData.query;
      };
    })
  }

  search= (input:HTMLInputElement) => {
    input.blur();
    this.router.navigate(['/search/'+input.value]);
  };

  top(event:any){
    event.stopPropagation();
    event.preventDefault()
    const element = document.querySelector('body');
    element?.scrollIntoView();
  };
}
