import { describe, expect, it } from 'vitest';
import { CataloguePlayableKind } from './catalogue-playable-kind.enum';
import { playablePublishPath } from './playable-publish-path';

const id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

describe('playablePublishPath', () => {
  it('uses kind publish routes for Film, NewsReport and TvShowEpisode', () => {
    expect(playablePublishPath(id, CataloguePlayableKind.Film)).toBe(`/film/${id}/publish`);
    expect(playablePublishPath(id, CataloguePlayableKind.NewsReport)).toBe(`/newsreport/${id}/publish`);
    expect(playablePublishPath(id, CataloguePlayableKind.TvShowEpisode)).toBe(
      `/tvshowepisode/${id}/publish`
    );
  });

  it('keeps podcast Episode and unknown kinds on guid-only episode publish', () => {
    expect(playablePublishPath(id, CataloguePlayableKind.Episode)).toBe(`/episode/publish/${id}`);
    expect(playablePublishPath(id, undefined)).toBe(`/episode/publish/${id}`);
    expect(playablePublishPath(id, null)).toBe(`/episode/publish/${id}`);
  });
});
