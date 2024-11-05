import { Component, ExperimentalPendingTasks, Inject, inject, PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, } from '@angular/router';
import { PodcastApiComponent } from '../podcast-api/podcast-api.component';
import { GuidService } from '../guid.service';
import { SeoService } from '../seo.service';
import { EpisodeService } from '../episode.service';
import { isPlatformServer } from '@angular/common';
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
  isServer: boolean;
  episode: ISearchResult | undefined;
  isEpisode: boolean = false;
  taskService = inject(ExperimentalPendingTasks);

  constructor(
    private seoService: SeoService,
    private guidService: GuidService,
    private episodeService: EpisodeService,
    @Inject(PLATFORM_ID) platformId: any  ) {
    this.isServer = isPlatformServer(platformId);
  }

  async ngOnInit(): Promise<any> {
    const taskCleanup = this.taskService.add();
    await this.populateTags();
    taskCleanup();
  }

  private route = inject(ActivatedRoute);

  async populateTags(): Promise<any> {
    this.route.params.subscribe(async params => {
      this.podcastName = params["podcastName"];
      let pageDetails: IPageDetails = { title: this.podcastName };
      const episodeUuid = this.guidService.getEpisodeUuid(params["query"]);
      this.isEpisode = episodeUuid != "";
      if (this.isEpisode) {
        let episodePageDetails: IPageDetails | undefined;
        try {
          if (this.isServer) {
            episodePageDetails = await this.episodeService.getEpisodeDetailsFromKv(episodeUuid, this.podcastName);
          }
          if (!episodePageDetails) {
            var episode = await this.episodeService.GetEpisodeDetailsFromApi(episodeUuid, this.podcastName);
            if (episode) {
              this.episode = episode;
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
      this.seoService.AddMetaTags(pageDetails);
    });
  }
}
