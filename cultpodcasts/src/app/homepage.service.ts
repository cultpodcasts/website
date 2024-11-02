import { Inject, Injectable, Optional, PLATFORM_ID } from '@angular/core';
import { IHomepage } from './IHomepage';
import { environment } from './../environments/environment';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { R2Bucket } from '@cloudflare/workers-types';

@Injectable({
  providedIn: 'root'
})
export class HomepageService {
  isBrowser: boolean;
  isServer: boolean;
  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: any,
    @Optional() @Inject('content') private contentBucket: R2Bucket

  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.isServer = isPlatformServer(platformId);
  }

  getHomepage(): Promise<IHomepage> {
    var homepageData: IHomepage | undefined;
    if (this.isBrowser) {
      console.log("-1");
      firstValueFrom(this.http.get<IHomepage>(new URL("/homepage", environment.api).toString()))
        .then(d => homepageData = d)
        .catch(e => Promise.reject(e));
    } else if (this.isServer) {
      console.log("-2");
      this.contentBucket.get("homepage")
        .then(x => {
          console.log("-3");
          if (!x) {
            console.log("-4");
            return Promise.reject("No homepage data");
          }
          else {
            console.log("-5");
            console.log("got homepage data. deserialising")
            x.text().then(d => {
              console.log(d)
              return Promise.resolve(JSON.parse(d) as IHomepage)
            })
              .catch(e => {
                console.log("-6");
                console.log(e);
                return Promise.reject(e);
              });
          }
          console.log("-7");
          return Promise.reject("unknown")
        })
        .then(data => {
          console.log("-8");
          homepageData = data
        })
        .catch(e => {
          console.log("-9");
          console.log("caught " + e)
          Promise.reject(e)
        });
    } else {
      console.log("-10");
      console.log("unknown platform")
      Promise.reject('Unknown platform.');
    }
    if (!homepageData) {
      console.log("-11");
      return Promise.reject("unable to obtain homepage-data");
    }
    console.log("-12");
    return Promise.resolve(homepageData);
  }
}

