import { Inject, Injectable, Optional } from '@angular/core';
import { IHomepage } from './IHomepage';
import { environment } from './../environments/environment';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { R2Bucket, KVNamespace } from '@cloudflare/workers-types';

@Injectable({
  providedIn: 'root'
})
export class HomepageService {
  constructor(
    private http: HttpClient,
    @Optional() @Inject('content') private contentBucket: R2Bucket,
    @Optional() @Inject('kvcontent') private kvcontent: KVNamespace
  ) { }

  async getHomepageFromKv(): Promise<IHomepage | undefined> {
    console.log(`kv: ${this.kvcontent}`);
    if (this.kvcontent) {
      const key = "homepage";
      const homepageJson = await this.kvcontent.getWithMetadata<{ published: string }>(key);
      console.log(`homepageJson: ${homepageJson}`);
      if (homepageJson != null && homepageJson.metadata != null) {
        var published = homepageJson.metadata.published;
        console.log(`published: ${published}`);
        if (homepageJson.value) {
          const homepage=  JSON.parse(homepageJson.value);
          console.log(`homepage: ${homepage}`);
          return homepage;
        }
      }
    }
    return undefined;
  }

  async getHomepageFromR2(): Promise<IHomepage | undefined> {
    if (this.contentBucket) {
      var r2Obj = await this.contentBucket.get("homepage");
      if (r2Obj) {
        var homepage = await r2Obj.json<IHomepage>();
        return homepage;
      } else {
        throw new Error("No homepage object");
      }
    }
    console.log(`no homepage content`);
    return;
  }

  async getHomepageFromApi(): Promise<IHomepage> {
    return await firstValueFrom(this.http.get<IHomepage>(new URL("/homepage", environment.api).toString()));
  }
}

