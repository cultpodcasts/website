import { describe, expect, it } from 'vitest';
import { CataloguePlayableKind } from './catalogue-playable-kind.enum';
import { playableDeletePath } from './playable-delete-path';

const id = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const podcastId = 'ffffffff-1111-4222-8333-444444444444';

describe('playableDeletePath', () => {
  it('uses kind delete routes for Film, NewsReport and TvShowEpisode', () => {
    expect(playableDeletePath(id, CataloguePlayableKind.Film)).toBe(`/film/${id}`);
    expect(playableDeletePath(id, CataloguePlayableKind.NewsReport)).toBe(`/newsreport/${id}`);
    expect(playableDeletePath(id, CataloguePlayableKind.TvShowEpisode)).toBe(
      `/tvshowepisode/${id}`
    );
  });

  it('uses podcastId + episodeId for Episode delete', () => {
    expect(playableDeletePath(id, CataloguePlayableKind.Episode, podcastId)).toBe(
      `/episode/${podcastId}/${id}`
    );
    expect(playableDeletePath(id, undefined, podcastId)).toBe(`/episode/${podcastId}/${id}`);
    expect(playableDeletePath(id, null, podcastId)).toBe(`/episode/${podcastId}/${id}`);
  });

  it('returns null for Episode delete when podcastId is missing', () => {
    expect(playableDeletePath(id, CataloguePlayableKind.Episode)).toBeNull();
    expect(playableDeletePath(id, CataloguePlayableKind.Episode, null)).toBeNull();
    expect(playableDeletePath(id, undefined)).toBeNull();
  });

  it('percent-encodes ids for parity with publish paths', () => {
    const weirdId = 'id/with spaces';
    const weirdPodcast = 'pod/id';
    expect(playableDeletePath(weirdId, CataloguePlayableKind.Film)).toBe(
      `/film/${encodeURIComponent(weirdId)}`
    );
    expect(playableDeletePath(weirdId, CataloguePlayableKind.Episode, weirdPodcast)).toBe(
      `/episode/${encodeURIComponent(weirdPodcast)}/${encodeURIComponent(weirdId)}`
    );
  });
});
