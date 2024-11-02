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

  async getHomepage(): Promise<IHomepage> {
    var homepageData: IHomepage | undefined;
    if (this.isBrowser) {
      console.log("-1")
      return await firstValueFrom(this.http.get<IHomepage>(new URL("/homepage", environment.api).toString()));
    } else if (this.isServer) {
      console.log("-2");
      var r2Obj = await this.contentBucket.get("homepage");
      if (r2Obj) {
        console.log("-3");
        var r2Json = await r2Obj?.text();
        if (r2Json) {
          console.log("-4");
          return JSON.parse(r2Json) as IHomepage;
        } else {
          console.log("-5");
          throw new Error("No homepage text");
        }
      } else {
        console.log("-6");
        throw new Error("No homepage object");
      }
    }
    console.log("-7");
    return Promise.reject("Unable to obtain homepage");
  }
}

