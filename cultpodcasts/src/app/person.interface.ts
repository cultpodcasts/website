export interface Person {
    id: string;
    name: string;
    sortName?: string | null;
    /** Curator flag: sort using full name; round-trips via API as isOrganization. */
    isOrganization?: boolean | null;
    aliases?: string[] | null;
    twitterHandle?: string | null;
    blueskyHandle?: string | null;
}
