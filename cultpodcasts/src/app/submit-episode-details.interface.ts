import { PersonMatch } from './person-match.interface';

export interface SubmitEpisodeDetails {
    spotify: boolean;
    apple: boolean;
    youtube: boolean;
    subjects: string[];
    people?: string[];
    guestSuggestions?: PersonMatch[];
}
