import { SubmitGuestSuggestion } from './submit-guest-suggestion.interface';

export interface SubmitEpisodeDetails {
    spotify: boolean;
    apple: boolean;
    youtube: boolean;
    /** Streaming catalog keys present or added on this submit (bbcIplayer, vimeo, tubi, …). */
    extraServiceKeys?: string[];
    subjects: string[];
    /** Display names of guests auto-added during submit (toast only). */
    people?: string[];
    guestSuggestions?: SubmitGuestSuggestion[];
}
