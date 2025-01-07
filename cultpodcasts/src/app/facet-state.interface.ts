import { SearchResultsFacets } from "./search-results-facets.interface";

export interface FacetState {
    searchResultsFacets: SearchResultsFacets;
    subjects?: string[];
    podcasts?: string[];
    resetSubjects?:boolean;
    resetPodcasts?:boolean;
}