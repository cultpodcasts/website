import { Injectable } from '@angular/core';
import { SimplePodcast } from './simple-podcast.interface';
import { SimplePodcastsResult } from "./simple-podcasts-result.interface";
import { AuthServiceWrapper } from './auth-service-wrapper.class';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from './../environments/environment';

@Injectable({ providedIn: 'root' })
export class PodcastsService {
  isAuthenticated: boolean = false;

  constructor(
    private http: HttpClient,
    private auth: AuthServiceWrapper
  ) {
    auth.authService.isAuthenticated$.subscribe(x => this.isAuthenticated = x);
  }

  async getPodcasts(): Promise<SimplePodcastsResult> {
    let headers: HttpHeaders = new HttpHeaders();
    if (this.isAuthenticated) {
      const podcastsEndpoint = new URL("/podcasts", environment.api);
      let token: string | undefined;
      try {
        token = await firstValueFrom(this.auth.authService.getAccessTokenSilently({
          authorizationParams: {
            audience: `https://api.cultpodcasts.com/`,
            scope: 'submit'
          }
        }));
      } catch (e) {
        console.error(e);
      }
      if (token) {
        headers = headers.set("Authorization", "Bearer " + token);
      } else {
        return { unauthorised: true, error: false, results: undefined };
      }
      try {
        const results: SimplePodcast[] = await firstValueFrom(this.http.get<SimplePodcast[]>(podcastsEndpoint.toString(), { headers: headers }));
        return { unauthorised: false, error: false, results: results };
      } catch (error) {
        return { unauthorised: false, error: true, results: undefined };
      }
    }
    return { unauthorised: true, error: false, results: undefined };
  }
}
