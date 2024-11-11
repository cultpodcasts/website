export interface SearchResultsFacets {
    podcastName?: SearchResultFacet[];
    subject?: SearchResultFacet[];
}

export interface SearchResultFacet {
    count: number;
    value: string;
}
