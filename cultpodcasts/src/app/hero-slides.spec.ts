import { HomepageEpisode } from './homepage-episode.interface';
import {
  HERO_POOL_SIZE,
  buildAutofillPool,
  buildHeroSlides,
  pruneCuratedIdsToWeek,
  resolveCuratedEpisodes,
} from './hero-slides';

function ep(id: string, releaseHoursAgo = 0): HomepageEpisode {
  return {
    id,
    podcastName: `Show ${id}`,
    episodeTitle: `Episode ${id}`,
    episodeDescription: `Desc ${id}`,
    release: new Date(Date.now() - releaseHoursAgo * 3600_000),
    duration: '01:00:00',
    spotify: undefined,
    apple: undefined,
    youtube: undefined,
    bbc: undefined,
    internetArchive: undefined,
    subjects: [`Subject ${id}`],
    image: undefined,
  };
}

describe('hero-slides', () => {
  const all = Array.from({ length: 30 }, (_, i) => ep(`e${i}`, i));

  it('drops stale and duplicate curated ids and preserves curated order', () => {
    const resolved = resolveCuratedEpisodes(
      ['e2', 'missing', 'e0', 'e2', 'gone'],
      all
    );
    expect(resolved.map((e) => e.id)).toEqual(['e2', 'e0']);
  });

  it('prunes curated ids that fall out of the current week set', () => {
    const week = [all[0], all[1], all[2]];
    const result = pruneCuratedIdsToWeek(
      ['e1', 'e99-out-of-week', 'e0', 'e1'],
      week
    );
    expect(result.ids).toEqual(['e1', 'e0']);
    expect(result.pruned).toBe(true);
    expect(pruneCuratedIdsToWeek(['e0', 'e1'], week)).toEqual({
      ids: ['e0', 'e1'],
      pruned: false,
    });
  });

  it('uses curated list alone when resolved count is at least pool size', () => {
    const curatedIds = Array.from({ length: 18 }, (_, i) => `e${i}`);
    const slides = buildHeroSlides(curatedIds, all, {
      subjectRails: [],
      obscureCults: [],
      bucket: 0,
    });
    expect(slides).toHaveLength(18);
    expect(slides.map((e) => e.id)).toEqual(curatedIds);
  });

  it('autofills after curated when curated is under pool size', () => {
    const curatedIds = ['e5', 'e9', 'stale-id'];
    const slides = buildHeroSlides(curatedIds, all, {
      subjectRails: [{ episodes: [all[10], all[11]] }],
      obscureCults: [{ episodes: [all[12]] }],
      bucket: 0,
    });
    expect(slides).toHaveLength(HERO_POOL_SIZE);
    expect(slides[0].id).toBe('e5');
    expect(slides[1].id).toBe('e9');
    expect(slides.slice(2).every((s) => s.id !== 'e5' && s.id !== 'e9')).toBe(true);
    const ids = new Set(slides.map((s) => s.id));
    expect(ids.size).toBe(HERO_POOL_SIZE);
  });

  it('returns empty when there are no episodes', () => {
    expect(
      buildHeroSlides(['e0'], [], { subjectRails: [], obscureCults: [], bucket: 0 })
    ).toEqual([]);
  });

  it('autofill alone fills the pool when curation is empty', () => {
    const pool = buildAutofillPool(all, {
      subjectRails: [],
      obscureCults: [],
      bucket: 1,
    });
    expect(pool).toHaveLength(HERO_POOL_SIZE);
  });
});
