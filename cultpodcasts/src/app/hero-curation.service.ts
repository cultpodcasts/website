import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';
import { AUTH_SCOPE } from './auth.interceptor';
import { HeroCuration } from './hero-curation.interface';

export class HeroCurationConflictError extends Error {
  constructor(readonly current: HeroCuration) {
    super('Hero curation was updated elsewhere');
    this.name = 'HeroCurationConflictError';
  }
}

interface HeroCurationUpdate {
  episodeIds?: string[];
  railSubjects?: string[];
  expectedUpdatedAt?: string | null;
}

/**
 * Homepage curation: hero episode picks and pinned subject rails (Durable Object).
 * GET is public; PUT requires curate scope. Failures return empty lists so the
 * homepage can still autofill when the worker endpoint is missing or down.
 */
@Injectable({ providedIn: 'root' })
export class HeroCurationService {
  private readonly http = inject(HttpClient);

  async getHeroCuration(): Promise<HeroCuration> {
    try {
      const url = new URL('/hero-curation', environment.api).toString();
      const curation = await firstValueFrom(this.http.get<HeroCuration>(url));
      return {
        episodeIds: curation.episodeIds ?? [],
        railSubjects: curation.railSubjects ?? [],
        updatedAt: curation.updatedAt ?? null,
      };
    } catch (error) {
      console.warn('Hero curation unavailable; using empty curated lists.', error);
      return { episodeIds: [], railSubjects: [], updatedAt: null };
    }
  }

  setHeroCuration(episodeIds: string[], expectedUpdatedAt?: string | null): Promise<HeroCuration> {
    return this.put({ episodeIds, expectedUpdatedAt });
  }

  setRailSubjects(railSubjects: string[], expectedUpdatedAt?: string | null): Promise<HeroCuration> {
    return this.put({ railSubjects, expectedUpdatedAt });
  }

  /** Persist any combination of hero and rail picks in one PUT. */
  setHomepageCuration(update: HeroCurationUpdate): Promise<HeroCuration> {
    return this.put(update);
  }

  /** Partial update: the worker merges, so hero and rail picks don't clobber each other. */
  private async put(update: HeroCurationUpdate): Promise<HeroCuration> {
    try {
      const url = new URL('/hero-curation', environment.api).toString();
      const saved = await firstValueFrom(
        this.http.put<HeroCuration>(url, update, {
          context: new HttpContext().set(AUTH_SCOPE, 'curate'),
        })
      );
      return {
        episodeIds: saved.episodeIds ?? [],
        railSubjects: saved.railSubjects ?? [],
        updatedAt: saved.updatedAt ?? null,
      };
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 409) {
        const body = error.error as Partial<HeroCuration> | null;
        throw new HeroCurationConflictError({
          episodeIds: body?.episodeIds ?? [],
          railSubjects: body?.railSubjects ?? [],
          updatedAt: body?.updatedAt ?? null,
        });
      }
      console.error('Failed to save hero curation.', error);
      throw error;
    }
  }
}
