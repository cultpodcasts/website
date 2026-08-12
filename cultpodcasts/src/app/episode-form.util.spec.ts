import { ApiEpisode } from './api-episode.interface';
import {
  applyGuestSelection,
  buildEpisodeForm,
  catalogueAfterPersonChange,
  dateToLocalISO,
  episodeCataloguePeople,
  getEpisodeChanges,
  guestNamesWithPerson,
  mergeEpisodeSubjects,
  mergePeopleCatalogue,
  pendingPerson,
  personLabel,
  personMatchesFilter,
  regroupGuests,
  regroupSubjects,
  uniqueStrings,
  withoutGuestSuggestion
} from './episode-form.util';
import { Person } from './person.interface';
import { PersonMatch } from './person-match.interface';

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

  it('regroupGuests keeps selected names that are missing from the catalogue as stubs', () => {
    const people: Person[] = [{ id: '2', name: 'Bob' }];
    const result = regroupGuests(people, undefined, ['Alice', 'Bob'], '');
    expect(result.selectedGuests.map(p => p.name)).toEqual(['Alice', 'Bob']);
    expect(result.selectedGuests[0]).toEqual(pendingPerson('Alice'));
    expect(result.otherPeople.map(p => p.name)).toEqual([]);
  });

  it('mergePeopleCatalogue keeps locally created people missing from a stale fetch', () => {
    const existing: Person[] = [
      { id: '1', name: 'Alice' },
      { id: 'created-1', name: 'Dana' }
    ];
    const fetched: Person[] = [{ id: '1', name: 'Alice' }];
    const created: Person = { id: 'created-2', name: 'Evan' };
    const merged = mergePeopleCatalogue(existing, fetched, [created]);
    expect(merged.map(p => p.name)).toEqual(['Alice', 'Dana', 'Evan']);
  });

  it('mergePeopleCatalogue does not let a pending stub overwrite a real person', () => {
    const existing: Person[] = [{ id: '1', name: 'Alice', twitterHandle: '@alice' }];
    const merged = mergePeopleCatalogue(existing, undefined, [pendingPerson('Alice')]);
    expect(merged).toEqual([{ id: '1', name: 'Alice', twitterHandle: '@alice' }]);
  });

  it('catalogueAfterPersonChange upserts a created person onto a stale snapshot', () => {
    const existing: Person[] = [{ id: 'created-1', name: 'Dana' }];
    const fetched: Person[] = [{ id: '1', name: 'Alice' }];
    const created: Person = { id: 'created-2', name: 'Evan' };
    const people = catalogueAfterPersonChange(existing, fetched, 'Evan', created);
    expect(people.map(p => p.name)).toEqual(['Alice', 'Dana', 'Evan']);
  });

  it('guestNamesWithPerson appends a new guest without dropping existing names', () => {
    expect(guestNamesWithPerson(['Dana'], 'Evan')).toEqual(['Dana', 'Evan']);
    expect(guestNamesWithPerson(['Dana'], 'Dana')).toEqual(['Dana']);
  });

  it('episodeCataloguePeople adds suggestion people missing from the published list', () => {
    const published: Person[] = [{ id: '1', name: 'Host Show' }];
    const suggestions = [{ person: { id: '2', name: 'Suggested Guest', twitterHandle: '@guest' } }];
    const people = episodeCataloguePeople(published, undefined, suggestions);
    expect(people.map(p => p.name)).toEqual(expect.arrayContaining(['Host Show', 'Suggested Guest']));
    expect(people).toHaveLength(2);
  });

  describe('applyGuestSelection (add/edit episode dialog contract)', () => {
    it('keeps the first created guest when a second create refreshes a stale people list', () => {
      const first: Person = { id: 'c1', name: 'Dana Created', twitterHandle: '@dana' };
      const afterFirst = applyGuestSelection({
        allPeople: [{ id: '1', name: 'Host Show' }],
        currentGuests: [],
        personName: first.name,
        person: first
      });
      expect(afterFirst.guests).toEqual(['Dana Created']);
      expect(afterFirst.selectedGuests.map(p => p.name)).toEqual(['Dana Created']);

      const second: Person = { id: 'c2', name: 'Evan Created' };
      const staleFetch: Person[] = [{ id: '1', name: 'Host Show' }];
      const afterSecond = applyGuestSelection({
        allPeople: afterFirst.allPeople,
        fetched: staleFetch,
        currentGuests: afterFirst.guests,
        personName: second.name,
        person: second
      });

      expect(afterSecond.guests).toEqual(['Dana Created', 'Evan Created']);
      expect(afterSecond.selectedGuests.map(p => p.name)).toEqual(['Dana Created', 'Evan Created']);
      expect(afterSecond.allPeople.map(p => p.name)).toEqual(
        expect.arrayContaining(['Host Show', 'Dana Created', 'Evan Created'])
      );
    });

    it('adds a title/description suggestion missing from the published catalogue into Selected', () => {
      const suggested: Person = {
        id: 's1',
        name: 'Suggested Guest',
        twitterHandle: '@guest',
        blueskyHandle: 'guest.bsky.social'
      };
      const result = applyGuestSelection({
        allPeople: [{ id: '1', name: 'Host Show' }],
        currentGuests: ['Host Show'],
        personName: suggested.name,
        person: suggested
      });

      expect(result.guests).toEqual(['Host Show', 'Suggested Guest']);
      expect(result.selectedGuests).toEqual([
        { id: '1', name: 'Host Show' },
        suggested
      ]);
      expect(result.allPeople.some(p => p.name === 'Suggested Guest')).toBe(true);
    });

    it('removes only the accepted suggestion from the suggestion list', () => {
      const suggestions: PersonMatch[] = [
        { person: { id: 's1', name: 'Suggested Guest' }, matchResults: [{ term: 'Suggested Guest', matches: 1 }] },
        { person: { id: 's2', name: 'Other Guest' }, matchResults: [{ term: 'Other', matches: 1 }] }
      ];
      expect(withoutGuestSuggestion(suggestions, 'Suggested Guest').map(x => x.person.name))
        .toEqual(['Other Guest']);
    });
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
    expect(form.controls.lang.value).toBe('unset');
    expect(form.controls.spotify.value?.toString()).toBe('https://open.spotify.com/episode/x');
    expect(form.controls.spotifyImage.value?.toString()).toBe('https://img.example/spotify.jpg');
    expect(form.controls.guests.value).toEqual(['Alice']);
  });

  it('buildEpisodeForm defaults bluesky null to false and lang to unset', () => {
    const form = buildEpisodeForm(baseEpisode({ bluesky: null, lang: null }));
    expect(form.controls.blueskyPosted.value).toBe(false);
    expect(form.controls.lang.value).toBe('unset');
  });

  it('buildEpisodeForm maps stored en to unset (English)', () => {
    const form = buildEpisodeForm(baseEpisode({ lang: 'en-GB' }));
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
