import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import {
  applyIdentityIds,
  filmReleaseYear,
  runCatalogueIdentityLookup
} from './catalogue-identity-lookup';
import { CatalogueIdentityLookupResponse } from './catalogue-identity-lookup.interface';
import { AmbiguousIdentityAnswer, AmbiguousIdentityPrompt } from './ambiguous-identity-dialog/ambiguous-identity-dialog.component';

describe('applyIdentityIds', () => {
  it('fills only blank fields', () => {
    expect(applyIdentityIds(
      { imdbId: '', tmdbId: '', tvdbId: '99' },
      { imdbId: 'tt0000001', tmdbId: 12, tvdbId: 50 }
    )).toEqual({ imdbId: 'tt0000001', tmdbId: '12', changed: true });
  });

  it('does not overwrite existing ids', () => {
    expect(applyIdentityIds(
      { imdbId: 'tt1111111', tmdbId: 7, tvdbId: 8 },
      { imdbId: 'tt0000001', tmdbId: 12, tvdbId: 50 }
    )).toEqual({ changed: false });
  });
});

describe('filmReleaseYear', () => {
  it('reads year from yyyy and yyyy-MM-dd', () => {
    expect(filmReleaseYear('2021')).toBe(2021);
    expect(filmReleaseYear('2021-06-15')).toBe(2021);
    expect(filmReleaseYear('')).toBeUndefined();
  });
});

describe('runCatalogueIdentityLookup', () => {
  it('returns matched ids without opening a dialog', async () => {
    const post = vi.fn().mockReturnValue(of<CatalogueIdentityLookupResponse>({
      status: 'Matched',
      ids: { imdbId: 'tt0000001', tmdbId: 9 }
    }));
    const outcome = await runCatalogueIdentityLookup({} as MatDialog, post, {
      kind: 'Film',
      title: 'Synthetic Film'
    });
    expect(outcome).toEqual({
      kind: 'matched',
      ids: { imdbId: 'tt0000001', tmdbId: 9 },
      parentIds: undefined
    });
    expect(post).toHaveBeenCalledOnce();
  });

  it('re-posts with select after the curator picks a candidate', async () => {
    const prompt = vi.fn(async (
      _dialog: MatDialog,
      data: AmbiguousIdentityPrompt
    ): Promise<AmbiguousIdentityAnswer> => {
      expect(data.context).toBe('edit');
      expect(data.candidates[0].thumbnailUrl).toContain('w185');
      return { decision: 'select', key: 'tmdb:9' };
    });
    const post = vi.fn()
      .mockReturnValueOnce(of<CatalogueIdentityLookupResponse>({
        status: 'Ambiguous',
        identityDecision: {
          target: 'Film',
          query: 'Synthetic',
          candidates: [{
            key: 'tmdb:9',
            title: 'Synthetic',
            kind: 'Film',
            source: 'tmdb',
            pageUrl: 'https://www.themoviedb.org/movie/9',
            thumbnailUrl: 'https://image.tmdb.org/t/p/w185/p.jpg',
            description: 'Overview'
          }]
        }
      }))
      .mockReturnValueOnce(of<CatalogueIdentityLookupResponse>({
        status: 'Matched',
        ids: { tmdbId: 9, imdbId: 'tt0000009' }
      }));
    const outcome = await runCatalogueIdentityLookup(
      {} as MatDialog,
      post,
      { kind: 'Film', title: 'Synthetic' },
      prompt
    );
    expect(outcome.kind).toBe('matched');
    if (outcome.kind === 'matched') {
      expect(outcome.ids.imdbId).toBe('tt0000009');
    }
    expect(prompt).toHaveBeenCalledOnce();
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[1][0]).toMatchObject({
      identityDecision: 'select',
      selectedIdentityKey: 'tmdb:9'
    });
  });

  it('returns cancelled when the curator leaves identity unchanged', async () => {
    const prompt = vi.fn(async (): Promise<AmbiguousIdentityAnswer> => ({ decision: 'continue' }));
    const post = vi.fn().mockReturnValue(of<CatalogueIdentityLookupResponse>({
      status: 'Ambiguous',
      identityDecision: {
        target: 'TvShow',
        query: 'Synthetic Show',
        candidates: [{ key: 'tmdb:1', title: 'A', kind: 'TvShow', source: 'tmdb' }]
      }
    }));
    const outcome = await runCatalogueIdentityLookup(
      {} as MatDialog,
      post,
      { kind: 'TvShow', title: 'Synthetic Show' },
      prompt
    );
    expect(outcome).toEqual({ kind: 'cancelled' });
  });

  it('returns error when the HTTP call fails', async () => {
    const post = vi.fn().mockReturnValue(throwError(() => new Error('down')));
    const outcome = await runCatalogueIdentityLookup({} as MatDialog, post, {
      kind: 'Film',
      title: 'Synthetic'
    });
    expect(outcome).toEqual({ kind: 'error', message: 'Identity lookup failed.' });
  });
});
