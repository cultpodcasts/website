import { Inject, Injectable, Optional } from '@angular/core';
import { IPageDetails } from './page-details';
import { KVNamespace } from '@cloudflare/workers-types';
import { ShortnerRecord } from './shortner-record';
import { GuidService } from './guid.service';
import { environment } from './../environments/environment';
import { ISearchResult } from './ISearchResult';
import { ODataService } from './OdataService';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class EpisodeService {
  constructor(
    private guidService: GuidService,
    private oDataService: ODataService,
    @Optional() @Inject('kv') private kv: KVNamespace
  ) { }

  public async getEpisodeDetailsFromKv(episodeId: string, podcastName: string): Promise<IPageDetails | undefined> {
    if (this.kv) {
      const key = this.guidService.toBase64(episodeId);
      const episodeKvWithMetaData = await this.kv.getWithMetadata<ShortnerRecord>(key);
      if (episodeKvWithMetaData != null && episodeKvWithMetaData.metadata != null) {
        var episodeTitle = episodeKvWithMetaData.metadata.episodeTitle;
        if (episodeTitle) {
          console.log("Added meta-tags from kv");
          return {
            description: podcastName,
            title: `${episodeTitle} | ${podcastName}`,
            releaseDate: episodeKvWithMetaData.metadata.releaseDate,
            duration: episodeKvWithMetaData.metadata.duration
          };
        } else {
          console.warn("No episode name in kv");
          return { title: podcastName };
        }
      }
    }
    return undefined;
  }

  public async GetEpisodeDetailsFromApi(episodeId: string, podcastName: string): Promise<ISearchResult | undefined> {
    var result = await firstValueFrom(this.oDataService.getEntities<ISearchResult>(
      new URL("/search", environment.api).toString(),
      {
        search: "",
        filter: `(podcastName eq '${podcastName}' and id eq '${episodeId}')`,
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

  public async writeKv(episode: ISearchResult) {
    if (this.kv) {
      const key = this.guidService.toBase64(episode.id);
      const shortnerRecord: ShortnerRecord = {
        episodeTitle: episode.episodeTitle,
        releaseDate: episode.release.toLocaleDateString("en-GB"),
        duration: episode.duration
      };
      const encodedPodcastName =
        encodeURIComponent(episode.podcastName)
          .replaceAll("(", "%28")
          .replaceAll(")", "%29");
      this.kv.put(key, encodedPodcastName + "/" + episode.id, { metadata: shortnerRecord });
    }
  }
}
