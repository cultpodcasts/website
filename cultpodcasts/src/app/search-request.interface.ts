export interface SearchRequest {
    count: boolean;
    skip: number;
    top: number;
    searchMode: string;
    queryType: string;
    facets: string[];
    search: string | null;
    filter: string | null;
    orderby: string;
}