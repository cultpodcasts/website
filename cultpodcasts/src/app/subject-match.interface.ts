export type SubjectMatchSource = 'Title' | 'Description' | 'PodcastDefault';

/** Why a subject matched: the matched term and the field it matched in. */
export interface SubjectMatch {
    subject: string;
    term: string;
    source: SubjectMatchSource;
}
