import { HomepageEpisode } from './homepage-episode.interface';
import {
  RAIL_DISPLAY_SIZE,
  buildSubjectRails,
  collectSubjectRailCandidates,
  pruneRailSubjectsToWeek,
} from './rail-subjects';

function ep(
  id: string,
  subjects: string[],
  releaseHoursAgo = 0
): HomepageEpisode {
  return {
    id,
    podcastName: `Show ${id}`,
    episodeTitle: `Episode ${id}`,
    episodeDescription: `Desc ${id}`,
    release: new Date(Date.now() - releaseHoursAgo * 3600_000),
    duration: '01:00:00',
    subjects,
    image: undefined,
  };
}

describe('rail-subjects', () => {
  const episodes = [
    ep('a1', ['Scientology'], 1),
    ep('a2', ['Scientology'], 2),
    ep('a3', ['Scientology'], 3),
    ep('a4', ['Scientology'], 4),
    ep('b1', ['FLDS Church'], 1),
    ep('b2', ['FLDS Church'], 2),
    ep('b3', ['FLDS Church'], 3),
    ep('c1', ['NXIVM'], 1),
    ep('c2', ['NXIVM'], 2),
    ep('c3', ['NXIVM'], 3),
    ep('d1', ['Tiny Topic'], 1),
    ep('meta1', ['_internal', 'Cult Recovery'], 1),
    ep('meta2', ['Cult Recovery'], 2),
    ep('meta3', ['Cult Recovery'], 3),
  ];

  it('collects subjects with enough episodes including meta topics', () => {
    const candidates = collectSubjectRailCandidates(episodes);
    expect(candidates.map((c) => c.subject)).toEqual([
      'Scientology',
      'Cult Recovery',
      'FLDS Church',
      'NXIVM',
    ]);
    expect(candidates[0].episodes.map((e) => e.id)).toEqual([
      'a1',
      'a2',
      'a3',
      'a4',
    ]);
  });

  it('still skips internal underscore-prefixed subjects', () => {
    const candidates = collectSubjectRailCandidates([
      ep('x1', ['_internal'], 1),
      ep('x2', ['_internal'], 2),
      ep('x3', ['_internal'], 3),
      ep('y1', ['NXIVM'], 1),
      ep('y2', ['NXIVM'], 2),
      ep('y3', ['NXIVM'], 3),
    ]);
    expect(candidates.map((c) => c.subject)).toEqual(['NXIVM']);
  });

  it('prunes pinned subjects that leave the eligible week set', () => {
    const candidates = collectSubjectRailCandidates(episodes);
    const result = pruneRailSubjectsToWeek(
      ['FLDS Church', 'Gone Subject', 'FLDS Church', 'Scientology'],
      candidates
    );
    expect(result.subjects).toEqual(['FLDS Church', 'Scientology']);
    expect(result.pruned).toBe(true);
    expect(
      pruneRailSubjectsToWeek(['Scientology', 'FLDS Church'], candidates)
    ).toEqual({
      subjects: ['Scientology', 'FLDS Church'],
      pruned: false,
    });
  });

  it('prunes mixed day/subject order against the current day count', () => {
    const candidates = collectSubjectRailCandidates(episodes);
    const result = pruneRailSubjectsToWeek(
      ['day:1', 'Gone', 'day:0', 'Scientology', 'day:5'],
      candidates,
      2
    );
    expect(result.subjects).toEqual(['day:1', 'day:0', 'Scientology']);
    expect(result.pruned).toBe(true);
  });

  it('builds rails from pinned subjects only with no autofill', () => {
    const candidates = collectSubjectRailCandidates(episodes);
    expect(
      buildSubjectRails(['NXIVM', 'missing', 'Cult Recovery'], candidates).map(
        (r) => r.subject
      )
    ).toEqual(['NXIVM', 'Cult Recovery']);
  });

  it('returns empty when nothing is pinned', () => {
    const candidates = collectSubjectRailCandidates(episodes);
    expect(buildSubjectRails([], candidates)).toEqual([]);
  });

  it('returns empty when there are no candidates', () => {
    expect(buildSubjectRails(['Scientology'], [])).toEqual([]);
  });

  it('keeps full candidate lists so callers can cap display separately', () => {
    const many = Array.from({ length: RAIL_DISPLAY_SIZE + 5 }, (_, i) =>
      ep(`s${i}`, ['Scientology'], i)
    );
    const candidates = collectSubjectRailCandidates(many);
    expect(candidates[0].episodes.length).toBe(RAIL_DISPLAY_SIZE + 5);
    const displayed = candidates[0].episodes.slice(0, RAIL_DISPLAY_SIZE);
    expect(displayed.length).toBe(RAIL_DISPLAY_SIZE);
  });
});
