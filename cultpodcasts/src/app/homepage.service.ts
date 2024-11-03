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
  constructor(
    private http: HttpClient,
    @Optional() @Inject('content') private contentBucket: R2Bucket
  ) { }

  async getHomepageFromR2(): Promise<IHomepage> {
    var r2Obj = await this.contentBucket.get("homepage");
    if (r2Obj) {
      var r2Json = await r2Obj?.text();
      if (r2Json) {
        return JSON.parse(r2Json) as IHomepage;
      } else {
        throw new Error("No homepage text");
      }
    } else {
      console.log("-6");
      throw new Error("No homepage object");
    }
  }

  async getHomepageFromApi(): Promise<IHomepage> {
    return await firstValueFrom(this.http.get<IHomepage>(new URL("/homepage", environment.api).toString()));
  }
}

