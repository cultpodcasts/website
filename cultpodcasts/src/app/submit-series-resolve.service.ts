import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AUTH_SCOPE } from './auth.interceptor';
import { environment } from './../environments/environment';
import { parseAmbiguousPodcastIds } from './parse-ambiguous-podcast-ids';
import { Podcast } from './podcast.interface';

export type SubmitSeriesProbe =
  | { kind: 'unique'; podcast: Podcast }
  | { kind: 'missing' }
  | { kind: 'conflict'; ids: string[]; podcasts: Podcast[] }
  | { kind: 'error' };

@Injectable({ providedIn: 'root' })
export class SubmitSeriesResolveService {
  private readonly http = inject(HttpClient);

  async probeByName(name: string): Promise<SubmitSeriesProbe> {
    const term = name.trim();
    if (!term) {
      return { kind: 'error' };
    }

    const url = new URL(`/podcast/${encodeURIComponent(term)}`, environment.api).toString();
    try {
      const podcast = await firstValueFrom(
        this.http.get<Podcast>(url, { context: this.curateContext() })
      );
      if (!podcast?.id) {
        return { kind: 'error' };
      }
      return { kind: 'unique', podcast };
    } catch (error) {
      if (!(error instanceof HttpErrorResponse)) {
        return { kind: 'error' };
      }
      if (error.status === 404) {
        return { kind: 'missing' };
      }
      if (error.status === 409) {
        const ids = parseAmbiguousPodcastIds(error.error);
        if (!ids) {
          return { kind: 'error' };
        }
        const podcasts = await this.loadByIds(ids);
        if (podcasts.length !== ids.length) {
          return { kind: 'error' };
        }
        return { kind: 'conflict', ids, podcasts };
      }
      return { kind: 'error' };
    }
  }

  async loadByIds(ids: string[]): Promise<Podcast[]> {
    const podcasts: Podcast[] = [];
    for (const id of ids) {
      const podcast = await this.getById(id);
      if (podcast) {
        podcasts.push(podcast);
      }
    }
    return podcasts;
  }

  async getById(id: string): Promise<Podcast | undefined> {
    const url = new URL(`/podcast/${encodeURIComponent(id)}`, environment.api).toString();
    try {
      return await firstValueFrom(
        this.http.get<Podcast>(url, { context: this.curateContext() })
      );
    } catch (error) {
      console.error('Failed to load podcast by id for series conflict.', error);
      return undefined;
    }
  }

  private curateContext(): HttpContext {
    return new HttpContext().set(AUTH_SCOPE, 'curate');
  }
}
