import { HomepageEpisode } from './homepage-episode.interface';
import {
  SUBJECT_RAIL_COUNT,
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
    spotify: undefined,
    apple: undefined,
    youtube: undefined,
    bbc: undefined,
    internetArchive: undefined,
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

  it('collects subjects with enough episodes and skips meta subjects', () => {
    const candidates = collectSubjectRailCandidates(episodes);
    expect(candidates.map((c) => c.subject)).toEqual([
      'Scientology',
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

  it('puts pinned subjects first then autofills by popularity', () => {
    const candidates = collectSubjectRailCandidates(episodes);
    const rails = buildSubjectRails(
      ['NXIVM', 'missing'],
      candidates,
      SUBJECT_RAIL_COUNT
    );
    expect(rails.map((r) => r.subject)).toEqual([
      'NXIVM',
      'Scientology',
      'FLDS Church',
    ]);
  });

  it('uses only pinned subjects when they fill the rail count', () => {
    const candidates = collectSubjectRailCandidates(episodes);
    const rails = buildSubjectRails(
      ['FLDS Church', 'NXIVM'],
      candidates,
      2
    );
    expect(rails.map((r) => r.subject)).toEqual([
      'FLDS Church',
      'NXIVM',
    ]);
  });

  it('shows every pinned subject when pins exceed the rail count', () => {
    const candidates = collectSubjectRailCandidates(episodes);
    const rails = buildSubjectRails(
      ['FLDS Church', 'NXIVM', 'Scientology'],
      candidates,
      2
    );
    expect(rails.map((r) => r.subject)).toEqual([
      'FLDS Church',
      'NXIVM',
      'Scientology',
    ]);
  });

  it('returns empty when there are no candidates', () => {
    expect(buildSubjectRails(['Scientology'], [], 6)).toEqual([]);
  });
});
