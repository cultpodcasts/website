import { Injectable } from '@angular/core';
import { IPageDetails } from './page-details.interface';
import { environment } from './../environments/environment';
import { SearchResult } from './search-result.interface';
import { ODataService } from './odata.service';
import { firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { contentKindEquals, isUnknownContentKindField, isUnknownSearchFieldError, normalizePlayableHit, podcastNameEquals, seriesNameEquals, escapedOData } from './playable-search-hit';

@Injectable({
  providedIn: 'root'
})
export class EpisodeService {
  constructor(
    private oDataService: ODataService,
    private http: HttpClient
  ) { }

  public async getEpisodeDetailsFromKvViaApi(episodeId: string, podcastName: string): Promise<IPageDetails | undefined> {
    let host: string = environment.api;
    const url = new URL(`/pagedetails/${encodeURIComponent(podcastName.replaceAll("'", "%27"))}/${episodeId}`, host).toString();
    return await firstValueFrom(this.http.get<IPageDetails>(url));
  }

  public async GetEpisodeDetailsFromApi(
    episodeId: string,
    podcastName: string,
    contentKind?: string
  ): Promise<SearchResult | undefined> {
    try {
      return await this.lookupFiltered(episodeId, seriesNameEquals(podcastName), contentKind);
    } catch (error) {
      if (!isUnknownSearchFieldError(error)) {
        throw error;
      }
      return this.lookupFiltered(episodeId, podcastNameEquals(podcastName), contentKind);
    }
  }

  public async getPlayableById(episodeId: string): Promise<SearchResult | undefined> {
    return this.lookupFiltered(episodeId, null);
  }

  private async lookupFiltered(
    episodeId: string,
    nameFilter: string | null,
    contentKind?: string
  ): Promise<SearchResult | undefined> {
    try {
      return await this.fetchPlayable(episodeId, nameFilter, contentKind);
    } catch (error) {
      if (contentKind && isUnknownContentKindField(error)) {
        return this.fetchPlayable(episodeId, nameFilter);
      }
      throw error;
    }
  }

  private async fetchPlayable(
    episodeId: string,
    nameFilter: string | null,
    contentKind?: string
  ): Promise<SearchResult | undefined> {
    const idFilter = `(id eq '${escapedOData(episodeId)}')`;
    const parts = [idFilter];
    if (nameFilter) {
      parts.unshift(nameFilter);
    }
    if (contentKind) {
      parts.unshift(contentKindEquals(contentKind));
    }
    var result = await firstValueFrom(this.oDataService.getEntities<SearchResult>(
      new URL("/search", environment.api).toString(),
      {
        search: "",
        filter: parts.join(" and "),
        searchMode: 'any',
        queryType: 'simple',
        count: false,
        skip: 0,
        top: 20,
        facets: [],
        orderby: "release desc"
      }))
    if (result.status == 200) {
      if (result.entities && result.entities.length == 1) {
        return normalizePlayableHit(result.entities[0]);
      }
    }
    return undefined;
  }
}
