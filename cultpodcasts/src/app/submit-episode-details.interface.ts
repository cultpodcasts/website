import { SubmitGuestSuggestion } from './submit-guest-suggestion.interface';

export interface SubmitEpisodeDetails {
    spotify: boolean;
    apple: boolean;
    youtube: boolean;
    /**
     * Streaming catalog keys present or added on this submit (bbcIplayer, vimeo, tubi, …).
     * Spotify, Apple, and YouTube stay on the named flags and must not appear in this bag.
     */
    extraServiceKeys?: string[] | null;
    subjects: string[];
    /** Display names of guests auto-added during submit (toast only). */
    people?: string[];
    guestSuggestions?: SubmitGuestSuggestion[];
}
