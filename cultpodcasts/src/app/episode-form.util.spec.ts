import { ApiEpisode } from './api-episode.interface';
import {
  buildEpisodeForm,
  dateToLocalISO,
  getEpisodeChanges,
  mergeEpisodeSubjects,
  personLabel,
  personMatchesFilter,
  regroupGuests,
  regroupSubjects,
  uniqueStrings
} from './episode-form.util';
import { Person } from './person.interface';

function baseEpisode(overrides: Partial<ApiEpisode> = {}): ApiEpisode {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Title',
    description: 'Desc',
    posted: false,
    tweeted: false,
    bluesky: false,
    ignored: false,
    removed: false,
    explicit: false,
    release: new Date('2026-07-01T12:00:00.000Z'),
    duration: '01:00:00',
    urls: {
      spotify: new URL('https://open.spotify.com/episode/x'),
      apple: undefined,
      youtube: undefined,
      bbc: undefined,
      internetArchive: undefined
    },
    subjects: ['cult'],
    guests: ['Alice'],
    ...overrides
  };
}

describe('episode-form.util', () => {
  it('uniqueStrings dedupes while preserving first-seen order', () => {
    expect(uniqueStrings(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('dateToLocalISO returns a local-offset ISO substring without Z', () => {
    const iso = dateToLocalISO(new Date('2026-07-01T12:00:00.000Z'));
    expect(iso.length).toBe(23);
    expect(iso).not.toContain('Z');
  });

  it('personLabel includes handles when present', () => {
    const person: Person = {
      id: 'p1',
      name: 'Jane',
      twitterHandle: '@jane',
      blueskyHandle: 'jane.bsky.social'
    };
    expect(personLabel(person)).toBe('Jane (@jane jane.bsky.social)');
    expect(personLabel({ id: 'p2', name: 'Bob' })).toBe('Bob');
  });

  it('personMatchesFilter matches name, alias, and social handles', () => {
    const person: Person = {
      id: 'p1',
      name: 'Jane Doe',
      sortName: 'Doe',
      aliases: ['JD'],
      twitterHandle: '@janedoe',
      blueskyHandle: 'jane.bsky.social'
    };
    expect(personMatchesFilter(person, 'jane')).toBe(true);
    expect(personMatchesFilter(person, 'doe')).toBe(true);
    expect(personMatchesFilter(person, 'jd')).toBe(true);
    expect(personMatchesFilter(person, '@janedoe')).toBe(true);
    expect(personMatchesFilter(person, 'janedoe')).toBe(true);
    expect(personMatchesFilter(person, 'bsky')).toBe(true);
    expect(personMatchesFilter(person, 'zzz')).toBe(false);
  });

  it('regroupGuests resolves selected people and filters others', () => {
    const people: Person[] = [
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
      { id: '3', name: 'Carol' }
    ];
    const result = regroupGuests(people, undefined, ['Alice'], 'bo');
    expect(result.selectedGuests.map(p => p.name)).toEqual(['Alice']);
    expect(result.otherPeople.map(p => p.name)).toEqual(['Bob']);
  });

  it('regroupGuests filters other people by social handle as well as name', () => {
    const people: Person[] = [
      { id: '1', name: 'Alice Smith', twitterHandle: '@alice' },
      { id: '2', name: 'Bob Jones', blueskyHandle: 'bjones.bsky.social' },
      { id: '3', name: 'Carol' }
    ];
    expect(regroupGuests(people, undefined, [], 'alice').otherPeople.map(p => p.name))
      .toEqual(['Alice Smith']);
    expect(regroupGuests(people, undefined, [], '@alice').otherPeople.map(p => p.name))
      .toEqual(['Alice Smith']);
    expect(regroupGuests(people, undefined, [], 'bjones').otherPeople.map(p => p.name))
      .toEqual(['Bob Jones']);
    expect(regroupGuests(people, undefined, [], 'smith').otherPeople.map(p => p.name))
      .toEqual(['Alice Smith']);
  });

  it('buildEpisodeForm maps ApiEpisode into form controls', () => {
    const episode = baseEpisode({
      bluesky: true,
      lang: 'en',
      searchTerms: 'foo',
      images: { spotify: new URL('https://img.example/spotify.jpg') }
    });
    const form = buildEpisodeForm(episode);
    expect(form.controls.title.value).toBe('Title');
    expect(form.controls.blueskyPosted.value).toBe(true);
    expect(form.controls.lang.value).toBe('en');
    expect(form.controls.spotify.value?.toString()).toBe('https://open.spotify.com/episode/x');
    expect(form.controls.spotifyImage.value?.toString()).toBe('https://img.example/spotify.jpg');
    expect(form.controls.guests.value).toEqual(['Alice']);
  });

  it('buildEpisodeForm defaults bluesky null to false and lang to unset', () => {
    const form = buildEpisodeForm(baseEpisode({ bluesky: null, lang: null }));
    expect(form.controls.blueskyPosted.value).toBe(false);
    expect(form.controls.lang.value).toBe('unset');
  });

  it('mergeEpisodeSubjects unions episode subjects, catalogue, and default', () => {
    const merged = mergeEpisodeSubjects(
      ['cult'],
      [{ name: 'comedy' }, { name: 'cult' }],
      'default-subject'
    );
    expect(merged.subjects).toContain('cult');
    expect(merged.subjects).toContain('comedy');
    expect(merged.allSubjects).toContain('default-subject');
  });

  it('regroupSubjects hoists default and selected, filters others by term', () => {
    const withFilter = regroupSubjects(
      ['cult'],
      ['cult', 'comedy', 'news', 'default'],
      'default',
      ['news'],
      'com'
    );
    expect(withFilter.selectedSubjects).toEqual(['cult']);
    expect(withFilter.otherSubjects).toEqual(['comedy']);

    const unfiltered = regroupSubjects(
      ['cult'],
      ['cult', 'comedy', 'news', 'default'],
      'default',
      ['news'],
      ''
    );
    expect(unfiltered.hoistedSubjects).toContain('default');
    expect(unfiltered.hoistedSubjects).toContain('news');
  });

  describe('getEpisodeChanges', () => {
    it('returns empty object when snapshots match', () => {
      const episode = baseEpisode();
      expect(getEpisodeChanges(episode, { ...episode })).toEqual({});
    });

    it('includes title and description when they change', () => {
      const prev = baseEpisode();
      const now = baseEpisode({ title: 'New', description: 'New desc' });
      expect(getEpisodeChanges(prev, now)).toEqual({
        title: 'New',
        description: 'New desc'
      });
    });

    it('clears a URL with empty string when removed', () => {
      const prev = baseEpisode();
      const now = baseEpisode({
        urls: { ...prev.urls, spotify: undefined }
      });
      const changes = getEpisodeChanges(prev, now);
      expect(changes.urls).toEqual({ spotify: '' });
    });

    it('diffs images and guests', () => {
      const prev = baseEpisode({
        images: { youtube: new URL('https://img.example/old.jpg') },
        guests: ['Alice']
      });
      const now = baseEpisode({
        images: { youtube: new URL('https://img.example/new.jpg') },
        guests: ['Alice', 'Bob']
      });
      const changes = getEpisodeChanges(prev, now);
      expect(changes.images?.youtube?.toString()).toBe('https://img.example/new.jpg');
      expect(changes.guests).toEqual(['Alice', 'Bob']);
    });

    it('maps lang unset to empty string in the patch', () => {
      const prev = baseEpisode({ lang: 'en' });
      const now = baseEpisode({ lang: 'unset' });
      expect(getEpisodeChanges(prev, now).lang).toBe('');
    });
  });
});
