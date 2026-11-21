import type { EpisodeDtoPersonMatch, PersonDto } from '@cultpodcasts/contracts';
import { Person } from './person.interface';
import { PersonMatch } from './person-match.interface';

/**
 * Boundary from the generated `Api.Dtos.PersonDto` (every key present, `id` and `name` nullable on the wire) to the
 * curator UI's {@link Person}, which needs both. People the API returns are catalogue entities that always have an
 * id and a name; one without either cannot be matched or shown, so it is left out. `null` becomes `undefined`.
 */
export function peopleFromDto(people: readonly PersonDto[] | null | undefined): Person[] | undefined {
  return people?.filter(isPerson);
}

/** {@link peopleFromDto} for `Api.Dtos.EpisodeDto+PersonMatch` guest suggestions. */
export function personMatchesFromDto(matches: readonly EpisodeDtoPersonMatch[] | null | undefined): PersonMatch[] | undefined {
  return matches?.filter((match): match is EpisodeDtoPersonMatch & PersonMatch => isPerson(match.person));
}

function isPerson(person: PersonDto): person is PersonDto & Person {
  return typeof person.id === 'string' && typeof person.name === 'string';
}
