import { describe, expect, it } from 'vitest';
import { peopleFromDto, personMatchesFromDto } from './person-dto.util';

const person = (id: string | null, name: string | null) => ({
  id, name, sortName: null, isOrganization: null, aliases: null, twitterHandle: null, blueskyHandle: null
});

describe('person-dto.util', () => {
  it('keeps the same PersonDto objects that have an id and a name, in order', () => {
    const alice = person('a', 'Alice');
    const bob = person('b', 'Bob');
    const people = peopleFromDto([alice, person(null, 'No Id'), person('c', null), bob]);
    expect(people).toEqual([alice, bob]);
    expect(people?.[0]).toBe(alice);
  });

  it('maps null and undefined to undefined', () => {
    expect(peopleFromDto(null)).toBeUndefined();
    expect(peopleFromDto(undefined)).toBeUndefined();
    expect(personMatchesFromDto(null)).toBeUndefined();
  });

  it('keeps guest suggestions whose person has an id and a name', () => {
    const matches = personMatchesFromDto([
      { person: person('a', 'Alice'), matchResults: [{ term: 'Alice', matches: 2 }] },
      { person: person(null, null), matchResults: [] }
    ]);
    expect(matches?.map(x => x.person.name)).toEqual(['Alice']);
  });
});
