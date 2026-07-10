export interface Person {
    id: string;
    name: string;
    sortName?: string | null;
    aliases?: string[] | null;
    twitterHandle?: string | null;
    blueskyHandle?: string | null;
}
