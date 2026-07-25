import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';
import { AUTH_SCOPE } from './auth.interceptor';
import { HeroCuration } from './hero-curation.interface';

/**
 * KV-backed homepage hero curation list.
 * GET is public; PUT requires curate scope. Failures return an empty list so the
 * hero can still autofill when the worker endpoint is missing or down.
 */
@Injectable({ providedIn: 'root' })
export class HeroCurationService {
  private readonly http = inject(HttpClient);

  async getHeroCuration(): Promise<HeroCuration> {
    try {
      const url = new URL('/hero-curation', environment.api).toString();
      return await firstValueFrom(this.http.get<HeroCuration>(url));
    } catch (error) {
      console.warn('Hero curation unavailable; using empty curated list.', error);
      return { episodeIds: [], updatedAt: null };
    }
  }

  async setHeroCuration(episodeIds: string[]): Promise<HeroCuration> {
    try {
      const url = new URL('/hero-curation', environment.api).toString();
      return await firstValueFrom(
        this.http.put<HeroCuration>(
          url,
          { episodeIds },
          { context: new HttpContext().set(AUTH_SCOPE, 'curate') }
        )
      );
    } catch (error) {
      console.error('Failed to save hero curation.', error);
      throw error;
    }
  }
}
