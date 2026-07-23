import { ChangeDetectionStrategy, Component, DestroyRef, Inject, inject, PLATFORM_ID, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, } from '@angular/router';
import { PodcastApiComponent } from '../podcast-api/podcast-api.component';
import { GuidService } from '../guid.service';
import { SeoService } from '../seo.service';
import { EpisodeService } from '../episode.service';
import { isPlatformServer } from '@angular/common';
import { IPageDetails } from '../page-details.interface';
import { SearchResult } from '../search-result.interface';
import { PodcastEpisodeComponent } from '../podcast-episode/podcast-episode.component';

@Component({
  selector: 'app-podcast',
  templateUrl: './podcast.component.html',
  styleUrls: ['./podcast.component.sass'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PodcastApiComponent,
    PodcastEpisodeComponent
  ]
})

export class PodcastComponent {
  podcastName: string = "";
  isServer: boolean;
  protected episode = signal<SearchResult | undefined>(undefined);
  protected isEpisode = signal<boolean>(false);
  protected isLoading = signal<boolean>(true);

  constructor(
    private seoService: SeoService,
    private guidService: GuidService,
    private episodeService: EpisodeService,
    @Inject(PLATFORM_ID) platformId: any) {
    this.isServer = isPlatformServer(platformId);
  }

  ngOnInit() {
    this.populateTags();
  }

  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);

  populateTags() {
    this.route.params.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(async params => {
      this.podcastName = params["podcastName"];
      let pageDetails: IPageDetails = { title: this.podcastName };
      const episodeUuid = this.guidService.getEpisodeUuid(params["query"]);
      const isEpisode = episodeUuid != "";
      this.isEpisode.set(isEpisode);
      if (isEpisode) {
        if (this.isServer) {
          this.episodeService.getEpisodeDetailsFromKvViaApi(episodeUuid, this.podcastName, this.isServer)
            .then(episodePageDetails => {
              if (episodePageDetails) {
                pageDetails = episodePageDetails;
              }
            })
            .catch(e => {
              console.error(JSON.stringify(e));
            }).finally(() => {
              this.seoService.AddMetaTags(pageDetails);
              this.isLoading.set(false);
            });
        } else {
          this.episodeService.GetEpisodeDetailsFromApi(episodeUuid, this.podcastName)
            .then(episode => {
              this.episode.set(episode);
              pageDetails = {
                description: this.podcastName,
                title: `${episode!.episodeTitle} | ${this.podcastName}`,
                releaseDate: episode!.release.toString(),
                duration: episode!.duration
              };
            })
            .catch(e => {
              console.error(e);
            })
            .finally(() => {
              this.seoService.AddMetaTags(pageDetails);
              this.isLoading.set(false);
            });
        }
      } else {
        this.seoService.AddMetaTags(pageDetails);
        this.isLoading.set(false);
      }
    });
  }
}
