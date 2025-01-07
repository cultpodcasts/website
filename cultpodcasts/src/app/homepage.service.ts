import { Injectable } from '@angular/core';
import { Homepage } from './homepage.interface';
import { environment } from './../environments/environment';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class HomepageService {
  constructor(
    private http: HttpClient
  ) { }

  async getHomepageFromApi(): Promise<Homepage> {
    return await firstValueFrom(this.http.get<Homepage>(new URL("/homepage", environment.api).toString()));
  }
}

