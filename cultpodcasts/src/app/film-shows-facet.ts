import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../environments/environment';
import { ODataService } from './odata.service';
import { SearchResult } from './search-result.interface';
import { SearchResultFacet } from './search-result-facet.interface';
import { SearchResultsFacets } from './search-results-facets.interface';

/**
 * #662: films are not filterable by show. A film's search document can carry, in seriesName, the YouTube channel
 * that uploaded it (a value left over from before the episode became a film), and that channel can share its name
 * with a real podcast. So the Shows chips never take a name from a film result, a Shows chip never matches a film,
 * and with only films selected there is no Shows row.
 */
export const FILM_KIND = "Film";

/** OData filter that leaves films out. Documents without contentKind are kept. */
export const NOT_FILM_FILTER = `contentKind ne '${FILM_KIND}'`;

/** True when the kind facet counts at least one film. */
export function hasFilms(facets: SearchResultsFacets | null | undefined): boolean {
  return (facets?.contentKind ?? []).some(k => k.value === FILM_KIND && k.count > 0);
}

/** True when the kind chips select films and nothing else. */
export function isFilmOnly(kinds: string[]): boolean {
  return kinds.length > 0 && kinds.every(k => k === FILM_KIND);
}

/** `filter` with films left out. */
export function andNotFilm(filter: string | null | undefined): string {
  return filter ? `${filter} and ${NOT_FILM_FILTER}` : NOT_FILM_FILTER;
}

/** `facets` with the show facet (seriesName, or podcastName on the legacy index) replaced by `shows`. */
export function withShowFacet(
  facets: SearchResultsFacets,
  field: "seriesName" | "podcastName",
  shows: SearchResultFacet[]
): SearchResultsFacets {
  return { ...facets, seriesName: undefined, podcastName: undefined, [field]: shows };
}

/**
 * The show facet for `search` and `filter` without films, from a facet-only search. Search facets count every
 * result, so leaving films out of the Shows chips takes its own request; callers make it only when films are among
 * the results. Emits null if it fails, so the caller can keep the facets it has.
 */
export function showFacetWithoutFilms(
  odata: ODataService,
  search: string | null,
  filter: string | null | undefined,
  field: "seriesName" | "podcastName"
): Observable<SearchResultFacet[] | null> {
  return odata.getEntitiesWithFacets<SearchResult>(
    new URL("/search", environment.api).toString(),
    {
      search,
      filter: andNotFilm(filter),
      searchMode: 'any',
      queryType: 'simple',
      count: false,
      skip: 0,
      top: 0,
      facets: [`${field},count:1000,sort:count`],
      orderby: ''
    }).pipe(
      map(data => data.facets[field] ?? []),
      catchError(e => {
        console.error(e);
        return of(null);
      }));
}
