export interface ISearchRequest {
    count: boolean;
    skip: number;
    top: number;
    searchMode: string;
    queryType: string;
    facet: string;
    search: string;
}