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
 * GET is public and returns the document. Mutations require curate scope, return
 * 202 with an empty body, and this service then GETs the document. A 409 is an
 * empty compare-and-swap loss; the current lists and updatedAt come from that GET.
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
      return await this.readHeroCuration();
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
    return this.commandThenRead(method, url, { episodeIds });
  }

  /** Partial update: the worker merges, so hero and rail picks don't clobber each other. */
  private put(update: HeroCurationUpdate): Promise<HeroCuration> {
    const url = new URL('/hero-curation', environment.api).toString();
    return this.commandThenRead('PUT', url, update);
  }

  private async readHeroCuration(bypassCache = false): Promise<HeroCuration> {
    const url = new URL('/hero-curation', environment.api).toString();
    const curation = await firstValueFrom(
      this.http.get<HeroCuration>(url, bypassCache
        ? { headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } }
        : undefined)
    );
    return {
      episodeIds: curation.episodeIds ?? [],
      railSubjects: curation.railSubjects ?? [],
      updatedAt: curation.updatedAt ?? null,
    };
  }

  /**
   * Command acknowledgement is 202 with an empty body. A lost compare-and-swap is
   * 409 with an empty body. The returned document is the following GET.
   */
  private async commandThenRead(
    method: 'PUT' | 'POST' | 'DELETE',
    url: string,
    body: unknown
  ): Promise<HeroCuration> {
    try {
      const response = await firstValueFrom(
        this.http.request(method, url, {
          body,
          context: new HttpContext().set(AUTH_SCOPE, 'curate'),
          observe: 'response',
          responseType: 'text',
        })
      );
      if (response.status !== 202) {
        throw new HttpErrorResponse({
          status: response.status,
          statusText: response.statusText,
          url,
        });
      }
      return await this.readHeroCuration(true);
    } catch (error) {
      if (error instanceof HttpErrorResponse && this.isConflictResponse(error)) {
        const current = await this.readHeroCuration(true);
        throw new HeroCurationConflictError(current);
      }
      console.error('Failed to save hero curation.', error);
      throw error;
    }
  }

  private isConflictResponse(error: HttpErrorResponse): boolean {
    if (error.status === 409) {
      return true;
    }
    return error.status === 400 && this.errorCode(error) === 'Conflict';
  }

  /** Command responses use responseType text, so a 400 body may still be a string. */
  private errorCode(error: HttpErrorResponse): string | undefined {
    const raw = error.error;
    if (typeof raw === 'string') {
      try {
        return (JSON.parse(raw) as { error?: string }).error;
      } catch {
        return undefined;
      }
    }
    if (raw && typeof raw === 'object' && 'error' in raw) {
      const code = (raw as { error?: unknown }).error;
      return typeof code === 'string' ? code : undefined;
    }
    return undefined;
  }
}
