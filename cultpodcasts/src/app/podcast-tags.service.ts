import { Inject, Injectable, Optional } from '@angular/core';
import { SeoService } from './seo.service';
import { GuidService } from './guid.service';
import { ShortnerRecord } from './shortner-record';
import { environment } from './../environments/environment';
import { KVNamespace } from '@cloudflare/workers-types';

@Injectable({
  providedIn: 'root'
})
export class PodcastTagsService {

  constructor(
    private seoService: SeoService,
    private guidService: GuidService,
    @Optional() @Inject('kv') private kv: KVNamespace
  ) { }

  getEpisodeUuid(queryParam: string): string {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuid.test(queryParam)) {
      return queryParam;
    } else {
      return "";
    }
  }

  async populateTags(query: string, podcastName: string): Promise<any> {
    const episodeUuid = this.getEpisodeUuid(query);
    let episodeTitle: string | undefined = undefined;
    if (episodeUuid != "") {
      const key = this.guidService.toBase64(episodeUuid);
      try {
        const episodeKvWithMetaData = await this.kv.getWithMetadata<ShortnerRecord>(key);
        if (episodeKvWithMetaData != null && episodeKvWithMetaData.metadata != null) {
          episodeTitle = episodeKvWithMetaData.metadata.episodeTitle;
          if (episodeTitle) {
            this.seoService.AddMetaTags({
              description: podcastName,
              title: `${episodeTitle} | ${podcastName}`,
              releaseDate: episodeKvWithMetaData.metadata.releaseDate,
              duration: episodeKvWithMetaData.metadata.duration
            });
            console.log("Added meta-tags from kv");
          } else {
            this.seoService.AddMetaTags({ title: podcastName });
            console.log("No episode name in kv");
          }
        } else {
          console.log("No entry in kv");
          var episodeQuery = {
            "search": "",
            "filter": `(id eq '${episodeUuid}')`,
            "searchMode": "any",
            "queryType": "simple",
            "count": false,
            "skip": 0,
            "top": 20,
            "facets": [],
            "orderby": "release desc"
          };
          const url = new URL("/search", environment.api).toString();
          let result = await fetch(url, {
            method: "POST",
            body: JSON.stringify(episodeQuery)
          });
          if (result.status == 200) {
            const body: any = await result.json();
            if (body.value && body.value.length == 1) {
              const episode = body.value[0];
              this.seoService.AddMetaTags({
                description: podcastName,
                title: `${episode.episodeTitle} | ${podcastName}`,
                releaseDate: episode.release.toString(),
                duration: episode.duration
              });
              const shortnerRecord: ShortnerRecord = {
                episodeTitle: episode.episodeTitle,
                releaseDate: episode.release.split('T')[0],
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
      } catch (error) {
        console.error(error);
        this.seoService.AddMetaTags({ title: podcastName });
      }
    } else {
      this.seoService.AddMetaTags({ title: podcastName });
    }
  }
}
