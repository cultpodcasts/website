export interface ISearchRequest {
    count: boolean;
    skip: number;
    top: number;
    searchMode: string;
    queryType: string;
    facets: string[];
    search: string;
}