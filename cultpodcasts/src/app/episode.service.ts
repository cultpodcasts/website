import { Inject, Injectable, Optional } from '@angular/core';
import { IPageDetails } from './page-details.interface';
import { environment } from './../environments/environment';
import { SearchResult } from './search-result.interface';
import { ODataService } from './odata.service';
import { firstValueFrom } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class EpisodeService {
  constructor(
    private oDataService: ODataService,
    private http: HttpClient,
    @Optional() @Inject('ssrSecret') private ssrSecret: string
  ) { }

  public async getEpisodeDetailsFromKvViaApi(episodeId: string, podcastName: string, ssr: boolean): Promise<IPageDetails | undefined> {
    console.log("getEpisodeDetailsFromKvViaApi", episodeId, podcastName, ssr);
    console.log("ssrSecretssrSecret", this.ssrSecret);
    const ssrSuffix = ssr ? "?ssr=true" : "";
    let host: string = environment.api;
    const url = new URL(`/pagedetails/${encodeURIComponent(podcastName.replaceAll("'", "%27"))}/${episodeId}${ssrSuffix}`, host).toString();
    console.log("url:" , url);
    const headers: HttpHeaders = new HttpHeaders();
    headers.set("Accept", "application/json");
    if (ssr && this.ssrSecret) {
      console.log("Setting secret header ending in", this.ssrSecret.slice(-2));
      headers.set("x-ssr-secret", this.ssrSecret);
    }
    return await firstValueFrom(this.http.get<IPageDetails>(url, { headers: headers }));
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
