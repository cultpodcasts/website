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
 * GET is public; mutations require curate scope.
 *
 * Episode membership:
 * - promote → POST /hero-curation/episodes (append, no CAS)
 * - demote → DELETE /hero-curation/episodes (remove, no CAS)
 * Full-list PUT of episodeIds is only for Manage-hero reorder/set-order.
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

  /** Manage-hero reorder / set ordered list. Prefer append/remove for single-id changes. */
  setHeroCuration(episodeIds: string[], expectedUpdatedAt?: string | null): Promise<HeroCuration> {
    return this.put({ episodeIds, expectedUpdatedAt });
  }

  setRailSubjects(railSubjects: string[], expectedUpdatedAt?: string | null): Promise<HeroCuration> {
    return this.put({ railSubjects, expectedUpdatedAt });
  }

  /** Append hero episode IDs (server-side merge, no CAS). */
  async appendEpisodes(episodeIds: string[]): Promise<HeroCuration> {
    return this.mutateEpisodeIds('POST', episodeIds);
  }

  /** Remove hero episode IDs (idempotent, no CAS). */
  async removeEpisodes(episodeIds: string[]): Promise<HeroCuration> {
    return this.mutateEpisodeIds('DELETE', episodeIds);
  }

  /**
   * Toggle an episode in the hero list via POST append or DELETE remove — never
   * a full-list PUT.
   */
  async toggleEpisode(
    episodeId: string,
    currentIds: readonly string[],
    _expectedUpdatedAt?: string | null
  ): Promise<HeroCuration> {
    if (currentIds.includes(episodeId)) {
      return this.removeEpisodes([episodeId]);
    }
    return this.appendEpisodes([episodeId]);
  }

  /** Persist any combination of hero and rail picks in one PUT. */
  setHomepageCuration(update: HeroCurationUpdate): Promise<HeroCuration> {
    return this.put(update);
  }

  private async mutateEpisodeIds(
    method: 'POST' | 'DELETE',
    episodeIds: string[]
  ): Promise<HeroCuration> {
    const url = new URL('/hero-curation/episodes', environment.api).toString();
    const saved = await firstValueFrom(
      this.http.request<HeroCuration>(method, url, {
        body: { episodeIds },
        context: new HttpContext().set(AUTH_SCOPE, 'curate'),
      })
    );
    return {
      episodeIds: saved.episodeIds ?? [],
      railSubjects: saved.railSubjects ?? [],
      updatedAt: saved.updatedAt ?? null,
    };
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
