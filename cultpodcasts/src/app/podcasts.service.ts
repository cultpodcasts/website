import { Injectable } from '@angular/core';
import { ISimplePodcast } from './ISimplePodcast';
import { ISimplePodcastsResult } from "./ISimplePodcastsResult";
import { AuthService, GetTokenSilentlyOptions } from '@auth0/auth0-angular';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from './../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PodcastsService {

  constructor(private http: HttpClient,private auth:AuthService) { }

  async getPodcasts():Promise<ISimplePodcastsResult> {
    let headers: HttpHeaders = new HttpHeaders();
    if (this.auth.isAuthenticated$) {
      const accessTokenOptions: GetTokenSilentlyOptions = {
        authorizationParams: {
          audience: `https://api.cultpodcasts.com/`,
          scope: 'submit'
        }
      };
      let token: string | undefined;
      try {
        token = await firstValueFrom( this.auth.getAccessTokenSilently(accessTokenOptions));
      } catch (e) {
        console.log(e);
      }
      if (token) {
        headers = headers.set("Authorization", "Bearer " + token);
      } else {
        return {unauthorised: true, error: false, results: undefined};
      }
      try {
        const results:ISimplePodcast[]=await firstValueFrom(this.http.get<ISimplePodcast[]>(new URL("/podcasts", environment.api).toString(), { headers: headers }));
        return {unauthorised: false, error: false, results: results};
      } catch (error) {
        return {unauthorised: false, error: true, results: undefined};
      }
    }
    return {unauthorised: true, error: false, results: undefined};
  }
}
