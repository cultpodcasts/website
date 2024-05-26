export interface ISearchState {
    episodeUuid: string;
    filter: string | null;
    page: number,
    query: string,
    sort: string
}