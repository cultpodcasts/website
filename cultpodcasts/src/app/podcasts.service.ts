import { Injectable } from '@angular/core';
import { SimplePodcast } from './simple-podcast.interface';
import { SimplePodcastsResult } from "./simple-podcasts-result.interface";
import { AuthServiceWrapper } from './auth-service-wrapper.class';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from './../environments/environment';

@Injectable({ providedIn: 'root' })
export class PodcastsService {
  constructor(
    private http: HttpClient,
    private auth: AuthServiceWrapper
  ) {
  }

  async getPodcasts(): Promise<SimplePodcastsResult> {
    const isAuthenticated = await firstValueFrom(this.auth.authService.isAuthenticated$);
    if (!isAuthenticated) {
      return { unauthorised: true, error: false, results: undefined };
    }

    let headers: HttpHeaders = new HttpHeaders();
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
    if (!token) {
      return { unauthorised: true, error: false, results: undefined };
    }

    headers = headers.set("Authorization", "Bearer " + token);
    try {
      const results: SimplePodcast[] = await firstValueFrom(
        this.http.get<SimplePodcast[]>(podcastsEndpoint.toString(), { headers: headers })
      );
      return { unauthorised: false, error: false, results: results };
    } catch (error) {
      return { unauthorised: false, error: true, results: undefined };
    }
  }
}
