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
    @Optional() @Inject('content') private r2: R2Bucket

  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.isServer = isPlatformServer(platformId);
  }

  async getHomepage(): Promise<IHomepage> {
    console.log("getHomepage")
    var homepageData: IHomepage | undefined;
    if (this.isBrowser) {
      console.log("get homepage from api")
      try {
      homepageData = await firstValueFrom(this.http.get<IHomepage>(new URL("/homepage", environment.api).toString()));
      } catch (error) {
        console.error(error);
        throw error;
      }
    } else if (this.isServer) {
      var objects= await this.r2.list();
      var _homepageData = await this.r2.get("homepage");
      console.log("post get homepage from r2")
      if (_homepageData) {
        console.log("got homepage from r2")
        homepageData = await _homepageData.json<IHomepage>();
        console.log(homepageData);
        console.log("deserialised homepage from r2")
      } else {
        console.log("no homepage found in r2")
        throw new Error('No homepage object in r2.')
      }
    } else {
      console.log("unknown platform")
      throw new Error('Unknown platform.');
    }
    return homepageData;
  }
}

