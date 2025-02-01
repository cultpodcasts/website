import { Injectable } from '@angular/core';
import { AuthServiceWrapper } from './auth-service-wrapper.class';
import { firstValueFrom, ReplaySubject, Subscription, timer } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from './..//environments/environment';
import { DiscoveryInfo } from './discovery-info.interface';

const interval = 60000;

@Injectable({
  providedIn: 'root'
})
export class DiscoveryInfoService {
  public discoveryInfo: ReplaySubject<DiscoveryInfo> = new ReplaySubject<DiscoveryInfo>(1);
  roles: string[] = [];
  timer: Subscription | undefined;
  currentDiscoveryInfo: DiscoveryInfo | undefined;

  constructor(
    private auth: AuthServiceWrapper,
    private http: HttpClient
  ) {
    this.auth.roles.subscribe(roles => {
      this.roles = roles;
      this.getDiscoveryInfo();
    });
  }

  getDiscoveryInfo() {
    if (this.timer) {
      this.timer.unsubscribe();
    }
    this.timer = timer(0, interval).subscribe(() => {
      if (this.roles.includes("Curator")) {
        var token = firstValueFrom(this.auth.authService.getAccessTokenSilently({
          authorizationParams: {
            audience: `https://api.cultpodcasts.com/`,
            scope: 'curate'
          }
        }));
        token.then(_token => {
          let headers: HttpHeaders = new HttpHeaders();
          headers = headers.set("Authorization", "Bearer " + _token);
          const endpoint = new URL("/discovery-info", environment.api).toString();
          this.http.get<DiscoveryInfo>(endpoint, { headers: headers })
            .subscribe({
              next: resp => {
                if (!this.same(this.currentDiscoveryInfo, resp)) {
                  this.currentDiscoveryInfo = resp;
                  this.discoveryInfo.next(this.currentDiscoveryInfo);
                }
              },
              error: e => {
                console.error(e);
              }
            })
        }).catch(e => {
          console.error(e);
        });
      }
    });
  }

  same(a: DiscoveryInfo | undefined, b: DiscoveryInfo): boolean {
    return a?.documentCount === b?.documentCount &&
      a.numberOfResults === b.numberOfResults &&
      a.discoveryBegan?.getTime() === b.discoveryBegan?.getTime();
  }

  ngOnDestroy() {
    if (this.timer) {
      this.timer.unsubscribe();
    }
  }
}
