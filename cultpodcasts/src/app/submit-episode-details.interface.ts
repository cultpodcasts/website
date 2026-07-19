import { SubmitGuestSuggestion } from './submit-guest-suggestion.interface';

export interface SubmitEpisodeDetails {
    spotify: boolean;
    apple: boolean;
    youtube: boolean;
    subjects: string[];
    /** Display names of guests auto-added during submit (toast only). */
    people?: string[];
    guestSuggestions?: SubmitGuestSuggestion[];
}
