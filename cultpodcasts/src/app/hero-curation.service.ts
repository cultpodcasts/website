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
 * GET is public; PUT/POST require curate scope. Failures return empty lists so the
 * homepage can still autofill when the worker endpoint is missing or down.
 *
 * Prefer {@link appendEpisodes} / {@link toggleEpisode} for single-id promote —
 * full-list PUT is for demote, manage-hero reorder, and rail saves, and needs CAS.
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

  /**
   * Append hero episode IDs (server-side merge, no CAS). Used by indexer
   * auto-promote and by curator star-to-add.
   */
  async appendEpisodes(episodeIds: string[]): Promise<HeroCuration> {
    const url = new URL('/hero-curation/episodes', environment.api).toString();
    const saved = await firstValueFrom(
      this.http.post<HeroCuration>(
        url,
        { episodeIds },
        { context: new HttpContext().set(AUTH_SCOPE, 'curate') }
      )
    );
    return {
      episodeIds: saved.episodeIds ?? [],
      railSubjects: saved.railSubjects ?? [],
      updatedAt: saved.updatedAt ?? null,
    };
  }

  /**
   * Toggle an episode in the hero list.
   * Promote uses POST append (no CAS). Demote uses PUT replace with CAS + one retry.
   */
  async toggleEpisode(
    episodeId: string,
    currentIds: readonly string[],
    expectedUpdatedAt: string | null
  ): Promise<HeroCuration> {
    const wantPromoted = !currentIds.includes(episodeId);
    if (wantPromoted) {
      return this.appendEpisodes([episodeId]);
    }

    const nextIds = currentIds.filter((id) => id !== episodeId);
    try {
      return await this.setHeroCuration(nextIds, expectedUpdatedAt);
    } catch (error) {
      if (!(error instanceof HeroCurationConflictError)) {
        throw error;
      }
      const retryIds = error.current.episodeIds.filter((id) => id !== episodeId);
      if (
        retryIds.length === error.current.episodeIds.length &&
        retryIds.every((id, i) => id === error.current.episodeIds[i])
      ) {
        return error.current;
      }
      try {
        return await this.setHeroCuration(retryIds, error.current.updatedAt);
      } catch (retryError) {
        if (retryError instanceof HeroCurationConflictError) {
          return retryError.current;
        }
        throw retryError;
      }
    }
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
      if (error instanceof HttpErrorResponse && this.isConflictResponse(error)) {
        const body = error.error as (Partial<HeroCuration> & { error?: string }) | null;
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

  private isConflictResponse(error: HttpErrorResponse): boolean {
    if (error.status === 409) {
      return true;
    }
    const body = error.error as { error?: string } | null;
    return error.status === 400 && body?.error === 'Conflict';
  }
}
