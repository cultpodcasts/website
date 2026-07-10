import { Person } from './person.interface';

export interface PersonMatchResult {
    term: string;
    matches: number;
}

export interface PersonMatch {
    person: Person;
    matchResults: PersonMatchResult[];
}
