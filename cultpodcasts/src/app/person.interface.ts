export interface Person {
    id: string;
    name: string;
    aliases?: string[] | null;
    twitterHandle?: string | null;
    blueskyHandle?: string | null;
}
