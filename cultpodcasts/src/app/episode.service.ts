import { Injectable } from '@angular/core';
import { IPageDetails } from './page-details.interface';
import { environment } from './../environments/environment';
import { SearchResult } from './search-result.interface';
import { ODataService } from './odata.service';
import { firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class EpisodeService {
  constructor(
    private oDataService: ODataService,
    private http: HttpClient
  ) { }

  public async getEpisodeDetailsFromKvViaApi(episodeId: string, podcastName: string, ssr: boolean): Promise<IPageDetails | undefined> {
    const ssrSuffix = ssr ? "?ssr=true" : "";
    let host: string = environment.api;
    const url = new URL(`/pagedetails/${encodeURIComponent(podcastName.replaceAll("'", "%27"))}/${episodeId}${ssrSuffix}`, host).toString();
    return await firstValueFrom(this.http.get<IPageDetails>(url));
  }

  public async GetEpisodeDetailsFromApi(episodeId: string, podcastName: string): Promise<SearchResult | undefined> {
    var result = await firstValueFrom(this.oDataService.getEntities<SearchResult>(
      new URL("/search", environment.api).toString(),
      {
        search: "",
        filter: `(podcastName eq '${podcastName.replaceAll("'", "''")}') and (id eq '${episodeId}')`,
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
        const episode = result.entities[0];
        return episode;
      }
    }
    return undefined;
  }
}
