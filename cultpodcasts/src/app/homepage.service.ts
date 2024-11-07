import { Inject, Injectable, Optional } from '@angular/core';
import { IHomepage } from './IHomepage';
import { environment } from './../environments/environment';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { R2Bucket } from '@cloudflare/workers-types';
import { IPreProcessedHomepage } from './IPreProcessedHomepage';

@Injectable({
  providedIn: 'root'
})
export class HomepageService {
  constructor(
    private http: HttpClient,
    @Optional() @Inject('content') private contentBucket: R2Bucket
  ) { }

  async getHomepageFromR2(): Promise<IHomepage | undefined> {
    if (this.contentBucket) {
      var r2Obj = await this.contentBucket.get("homepage");
      if (r2Obj) {
        var homepage = r2Obj.json<IHomepage>();
        return homepage;
      } else {
        throw new Error("No homepage object");
      }
    }
    return;
  }

  async getHomepageFromApi(): Promise<IHomepage> {
    return await firstValueFrom(this.http.get<IHomepage>(new URL("/homepage", environment.api).toString()));
  }

  async getPreProcessedHomepageFromApi(): Promise<IPreProcessedHomepage> {
      const json = await firstValueFrom(this.http.get<any>(new URL("/homepage-ssr", environment.api).toString()))
        .catch(e => {
          console.error("in .catch function")
          console.error(e)
        });
      return json as IPreProcessedHomepage;
  }
}
