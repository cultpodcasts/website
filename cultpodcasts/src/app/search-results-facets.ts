export interface SearchResultsFacets {
    podcastName?: SearchResultFacet[];
    subjects?: SearchResultFacet[];
}

export interface SearchResultFacet {
    count: number;
    value: string;
}
