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
  isBrowser: boolean;
  isServer: boolean;

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
    const episodeUuid = this.guidService.getEpisodeUuid(params["query"]);
    if (episodeUuid != "") {
      try {
        let pageDetails: IPageDetails | undefined;
        if (this.isServer) {
          pageDetails = await this.episodeService.getEpisodeDetailsFromR2(episodeUuid, this.podcastName);
        }
        if (!pageDetails) {
          var episode = await this.episodeService.GetEpisodeDetailsFromApi(episodeUuid, this.podcastName);
          if (episode) {
            pageDetails = {
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
        if (pageDetails) {
          this.seoService.AddMetaTags(pageDetails);
        }
      } catch (error) {
        console.error(error);
        this.seoService.AddMetaTags({ title: this.podcastName });
      }
    } else {
      this.seoService.AddMetaTags({ title: this.podcastName });
    }
  }
}
