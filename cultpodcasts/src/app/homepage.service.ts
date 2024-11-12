import { Inject, Injectable, Optional } from '@angular/core';
import { IHomepage } from './IHomepage';
import { environment } from './../environments/environment';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { R2Bucket } from '@cloudflare/workers-types';

@Injectable({
  providedIn: 'root'
})
export class HomepageService {
  constructor(
    private http: HttpClient
  ) { }

  async getHomepageFromApi(): Promise<IHomepage> {
    return await firstValueFrom(this.http.get<IHomepage>(new URL("/homepage", environment.api).toString()));
  }
}

