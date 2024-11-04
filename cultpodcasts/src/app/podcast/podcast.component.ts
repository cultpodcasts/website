import { Component, Inject, inject, Optional, PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { waitFor } from '../core.module';
import { PodcastApiComponent } from '../podcast-api/podcast-api.component';
import { GuidService } from '../guid.service';
import { SeoService } from '../seo.service';
import { KVNamespace } from '@cloudflare/workers-types';
import { EpisodeService } from '../episode.service';
import { isPlatformBrowser, isPlatformServer } from '@angular/common';
import { IPageDetails } from '../page-details';
import { ISearchResult } from '../ISearchResult';
import { PodcastEpisodeComponent } from '../podcast-episode/podcast-episode.component';

@Component({
  selector: 'app-podcast',
  templateUrl: './podcast.component.html',
  styleUrls: ['./podcast.component.sass'],
  standalone: true,
  imports: [
    PodcastApiComponent,
    PodcastEpisodeComponent
  ]
})

export class PodcastComponent {
  podcastName: string = "";
  isBrowser: boolean;
  isServer: boolean;
  episode: ISearchResult | undefined;

  constructor(
    private seoService: SeoService,
    private guidService: GuidService,
    private episodeService: EpisodeService,
    @Inject(PLATFORM_ID) private platformId: any,
    @Optional() @Inject('kv') private kv: KVNamespace
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.isServer = isPlatformServer(platformId);
  }

  async ngOnInit(): Promise<any> {
    waitFor(this.populateTags());
  }
  private route = inject(ActivatedRoute);

  async populateTags(): Promise<any> {
    const params = await firstValueFrom(this.route.params);
    this.podcastName = params["podcastName"];
    let pageDetails: IPageDetails = { title: this.podcastName };
    const episodeUuid = this.guidService.getEpisodeUuid(params["query"]);
    if (episodeUuid != "") {
      let episodePageDetails: IPageDetails | undefined;
      try {
        if (this.isServer) {
          episodePageDetails = await this.episodeService.getEpisodeDetailsFromR2(episodeUuid, this.podcastName);
        }
        if (!episodePageDetails) {
          var episode = await this.episodeService.GetEpisodeDetailsFromApi(episodeUuid, this.podcastName);
          if (episode) {
            this.episode= episode;
            episodePageDetails = {
              description: this.podcastName,
              title: `${episode.episodeTitle} | ${this.podcastName}`,
              releaseDate: episode.release.toString(),
              duration: episode.duration
            };
            if (this.isServer) {
              await this.episodeService.writeKv(episode);
            }
          }
        }
        if (episodePageDetails) {
          pageDetails = episodePageDetails;
        }
      } catch (error) {
        console.error(error);
      }
    }
    console.log(pageDetails);
    this.seoService.AddMetaTags(pageDetails);
  }
}
