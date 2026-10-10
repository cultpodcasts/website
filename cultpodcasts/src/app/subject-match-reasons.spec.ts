import { subjectMatchReasons } from './subject-match-reasons';

describe('subjectMatchReasons', () => {
  it('returns null when matches were not recorded or are empty, so chips stay plain', () => {
    expect(subjectMatchReasons(null)).toBeNull();
    expect(subjectMatchReasons(undefined)).toBeNull();
    expect(subjectMatchReasons([])).toBeNull();
  });

  it('describes the matched term and field per subject, joining multiple terms', () => {
    const reasons = subjectMatchReasons([
      { subject: 'Scientology', term: 'Hubbard', source: 'Title' },
      { subject: 'Scientology', term: 'Sea Org', source: 'Description' },
      { subject: 'NXIVM', term: 'Raniere', source: 'Description' },
    ]);

    expect(reasons).toEqual({
      Scientology: 'matched "Hubbard" in title; matched "Sea Org" in description',
      NXIVM: 'matched "Raniere" in description',
    });
  });

  it('describes podcast-default subjects without a term and collapses repeats', () => {
    const reasons = subjectMatchReasons([
      { subject: 'Cults', term: '', source: 'PodcastDefault' },
      { subject: 'Cults', term: '', source: 'PodcastDefault' },
    ]);

    expect(reasons).toEqual({ Cults: 'podcast default subject' });
  });

  it('labels an empty term on a title or description match by field, not as podcast default', () => {
    expect(subjectMatchReasons([
      { subject: 'A', term: '', source: 'Title' },
      { subject: 'B', term: '', source: 'Description' },
    ])).toEqual({ A: 'matched in title', B: 'matched in description' });
  });

  it('falls back to the lowercased source for an unknown future source', () => {
    const reasons = subjectMatchReasons([
      { subject: 'A', term: 'x', source: 'Transcript' as never },
    ]);

    expect(reasons?.['A']).toBe('matched "x" in transcript');
  });

  it('keeps prototype-named subjects as own keys only', () => {
    const reasons = subjectMatchReasons([{ subject: 'constructor', term: 'x', source: 'Title' }])!;

    expect(reasons['constructor']).toBe('matched "x" in title');
    expect(reasons['toString']).toBeUndefined();
  });
});
