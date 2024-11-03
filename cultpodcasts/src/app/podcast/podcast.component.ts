import { Component, Inject, inject, Optional } from '@angular/core';
import { ActivatedRoute, } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { waitFor } from '../core.module';
import { PodcastApiComponent } from '../podcast-api/podcast-api.component';
import { GuidService } from '../guid.service';
import { SeoService } from '../seo.service';
import { ShortnerRecord } from '../shortner-record';
import { environment } from './../../environments/environment';
import { KVNamespace } from '@cloudflare/workers-types';

@Component({
  selector: 'app-podcast',
  templateUrl: './podcast.component.html',
  styleUrls: ['./podcast.component.sass'],
  standalone: true,
  imports: [
    PodcastApiComponent
  ]
})

export class PodcastComponent {
  podcastName: string = "";

  constructor(
    private seoService: SeoService,
    private guidService: GuidService,
    @Optional() @Inject('kv') private kv: KVNamespace
  ) { }

  async ngOnInit(): Promise<any> {
    waitFor(this.initialiseServer());
  }
  private route = inject(ActivatedRoute);

  async initialiseServer(): Promise<any> {
    const params = await firstValueFrom(this.route.params);
    this.podcastName = params["podcastName"];
    await this.populateTags(params["query"], this.podcastName);
  }

  async populateTags(query: string, podcastName: string): Promise<any> {
    const episodeUuid = this.guidService.getEpisodeUuid(query);
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
