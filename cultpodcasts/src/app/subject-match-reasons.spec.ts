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
});
