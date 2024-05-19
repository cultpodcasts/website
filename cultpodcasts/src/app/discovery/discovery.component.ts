import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component } from '@angular/core';
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
  results: IDiscoveryResult[] | undefined;
  ids: string[] | undefined;
  isLoading: boolean = true;
  minDate: Date | undefined;
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
        })
    });
  }
}
