import { Injectable } from '@angular/core';
import { AuthServiceWrapper } from './AuthServiceWrapper';
import { BehaviorSubject, firstValueFrom, Observable } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from './../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ProfileService {
  roles: BehaviorSubject<string[]> = this.auth.roles;
  isAuthenticated$: Observable<boolean> = this.auth.authService.isAuthenticated$;
  public bookmarks: Set<string> = new Set([]);
  bookmarks$: BehaviorSubject<Set<string>> = new BehaviorSubject<Set<string>>(this.bookmarks);

  constructor(
    private http: HttpClient,
    private auth: AuthServiceWrapper,
  ) {
  }

  async init(): Promise<any> {
    var bookmarksResponse = await this.getBookmarks();
    if (bookmarksResponse.isUser && bookmarksResponse.success) {
      this.bookmarks = new Set(bookmarksResponse.episodeIds);
      this.bookmarks$.next(this.bookmarks);
    }
  }

  private async getBookmarks(): Promise<{ isUser: boolean, success: boolean, episodeIds: string[] }> {
    let authenticated = await firstValueFrom(this.auth.authService.isAuthenticated$);
    if (authenticated) {
      try {
        var token = await firstValueFrom(this.auth.authService.getAccessTokenSilently({
          authorizationParams: {
            audience: `https://api.cultpodcasts.com/`,
            scope: ''
          }
        }));
        let headers: HttpHeaders = new HttpHeaders();
        headers = headers.set("Authorization", "Bearer " + token);
        const episodeEndpoint = new URL(`/bookmarks`, environment.api).toString();
        var resp = await firstValueFrom(this.http.get<string[]>(episodeEndpoint, { headers: headers }));
        return { isUser: true, success: true, episodeIds: resp };
      } catch (error) {
        return { isUser: true, success: false, episodeIds: [] };
      }
    }
    return { isUser: false, success: true, episodeIds: [] };
  }
}
