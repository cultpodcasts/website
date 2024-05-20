import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { firstValueFrom, map } from 'rxjs';
import { environment } from './../../environments/environment';
import { IDiscoveryResult, IDiscoveryResults } from '../IDiscoveryResults';

@Component({
  selector: 'app-discovery',
  templateUrl: './discovery.component.html',
  styleUrls: ['./discovery.component.sass']
})
export class DiscoveryComponent {
  @ViewChild('resultsContainer', { static: false }) resultsContainer: ElementRef | undefined;

  results: IDiscoveryResult[] | undefined;
  ids: string[] | undefined;
  isLoading: boolean = true;
  minDate: Date | undefined;
  saveDisabled: boolean = true;
  closeDisabled:boolean= false;
  displaySave: boolean= false;
  constructor(private auth: AuthService, private http: HttpClient) { }

  ngOnInit() {
    var token = firstValueFrom(this.auth.getAccessTokenSilently({
      authorizationParams: {
        audience: `https://api.cultpodcasts.com/`,
        scope: 'curate'
      }
    }));
    token.then(_token => {
      let headers: HttpHeaders = new HttpHeaders();
      headers = headers.set("Authorization", "Bearer " + _token);
      const endpoint = new URL("/discovery-curation", environment.api).toString();
      this.http.get<IDiscoveryResults>(endpoint, { headers: headers })
        .subscribe(resp => {
          this.results = resp.results;
          this.ids = resp.ids;
          const dates = resp.results.map(x => x.released).filter(x => x.getTime).map(x => x.getTime());
          if (dates.length > 0)
            this.minDate = new Date(Math.min(...dates));
          this.isLoading = false;
          this.displaySave= true;
        })
    });
  }

  isYouTube(url: URL | undefined): boolean {
    if (!url) return false;
    const has = url.host.includes("youtube");
    return has;
  }

  isSpotify(url: URL | undefined): boolean {
    if (!url) return false;
    const has = url.host.includes("spotify");
    return has;
  }

  isApple(url: URL | undefined): boolean {
    if (!url) return false;
    const has = url.host.includes("apple");
    return has;
  }

  getYouTubeId(url: URL): string {
    const videoId = new RegExp("v=([\-\\w]+)");
    const shortId = new RegExp("shorts/([\-\\w]+)");
    const _url = url.toString();
    const videoMatch = _url.match(videoId);
    if (videoMatch) return videoMatch[1];
    const shortMatch = _url.match(shortId);
    return shortMatch![1];
  }

  getYouTubeImageUrl(url: URL) {
    const youTubeId = this.getYouTubeId(url)
    return `https://i.ytimg.com/vi/${youTubeId}/hqdefault.jpg`;
    //    return `https://i.ytimg.com/vi_webp/${youTubeId}/maxresdefault.webp`;
  }

  handleResult($event: Event, result: IDiscoveryResult) {
    const selectedClass: string = "selected";
    let element: Element = $event.target as Element;
    var isButton = false;
    isButton = element.getAttribute("mat-icon-button") != null;
    while (!isButton && element.nodeName.toLowerCase() != "mat-card") {
      console.log(element.nodeName)
      element = element.parentElement!;
      isButton = isButton || element.getAttribute("mat-icon-button") != null;
    }
    if (!isButton) {
      if (element.className.split(" ").includes(selectedClass)) {
        element.className = element.className.split(" ").filter(x => x != selectedClass).join(" ");
      } else {
        element.className = element.className.split(" ").concat(selectedClass).join(" ");
      }
    } 
    const itemsSelected= this.resultsContainer!.nativeElement.querySelectorAll("mat-card.selected").length;
    this.closeDisabled= itemsSelected > 0;
    this.saveDisabled = itemsSelected === 0;
  }

  allowLink($event: Event) {
    $event.stopPropagation();
 }

  close() {
    if (this.resultsContainer?.nativeElement.querySelectorAll("mat-card.selected").length == 0 && confirm("Are you sure you want to close?")) {
      this.save();
    }
  }

  save() {
    this.saveDisabled = true;
    const selected = this.resultsContainer?.nativeElement.querySelectorAll("mat-card.selected");
    const selectedArray = [...selected];
    const urls = selectedArray.map((x: any) => x.dataset.url);
    var token = firstValueFrom(this.auth.getAccessTokenSilently({
      authorizationParams: {
        audience: `https://api.cultpodcasts.com/`,
        scope: 'curate'
      }
    }));
    token.then(_token => {
      let headers: HttpHeaders = new HttpHeaders();
      headers = headers.set("Authorization", "Bearer " + _token);
      const endpoint = new URL("/discovery-curation", environment.api).toString();
      this.http.post(endpoint, {
        ids: this.ids,
        urls: urls
      }, { headers: headers })
        .subscribe(
          resp => {
            this.displaySave= false;
            alert(JSON.stringify(resp));
           }, 
          err => {
          this.saveError(err);
        })
    }).catch(r => {
      this.saveError(r)
    });
  }

  private saveError(r: any) {
    this.saveDisabled = false;
    alert(JSON.stringify(r));
  }

}
