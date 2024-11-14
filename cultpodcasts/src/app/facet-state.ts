import { SearchResultsFacets } from "./search-results-facets";

export interface FacetState {
    searchResultsFacets: SearchResultsFacets;
    subjects?: string[];
    podcasts?: string[];
    resetSubjects?:boolean;
    resetPodcasts?:boolean;
}