import { PersonMatchResult } from './person-match.interface';

/** Submit-url guest suggestion — name only; People are unique on name. */
export interface SubmitGuestSuggestion {
    name: string;
    matchResults: PersonMatchResult[];
}
