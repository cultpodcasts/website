import { ChangeDetectionStrategy, Component, DestroyRef, Inject, inject, PLATFORM_ID, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PodcastApiComponent } from '../podcast-api/podcast-api.component';
import { GuidService } from '../guid.service';
import { SeoService } from '../seo.service';
import { EpisodeService } from '../episode.service';
import { isPlatformServer } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { IPageDetails } from '../page-details.interface';
import { SearchResult } from '../search-result.interface';
import { PodcastEpisodeComponent } from '../podcast-episode/podcast-episode.component';
import { SiteLoadingComponent } from '../site-loading/site-loading.component';

@Component({
  selector: 'app-podcast',
  templateUrl: './podcast.component.html',
  styleUrls: ['./podcast.component.sass'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PodcastApiComponent,
    PodcastEpisodeComponent,
    SiteLoadingComponent,
    MatButtonModule,
    RouterLink
  ]
})

export class PodcastComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

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
    // Align the @if (isEpisode) branch with SSR before the first template pass.
    // Starting at false made the client claim app-podcast-api against an SSR
    // loading shell and blew up AppComponent hydration (TypeError on 'd'/hasAttribute).
    this.applyRouteParams(this.route.snapshot.params);
  }

  ngOnInit() {
    this.populateTags();
  }

  private applyRouteParams(params: Record<string, string | undefined>): void {
    this.podcastName = params["podcastName"] ?? "";
    const episodeUuid = this.guidService.getEpisodeUuid(params["query"] ?? "");
    this.isEpisode.set(episodeUuid != "");
    this.episode.set(undefined);
    this.isLoading.set(true);
  }

  populateTags() {
    this.route.params.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(async params => {
      this.applyRouteParams(params);
      let pageDetails: IPageDetails = { title: this.podcastName };
      const episodeUuid = this.guidService.getEpisodeUuid(params["query"] ?? "");
      const isEpisode = episodeUuid != "";
      if (isEpisode) {
        if (this.isServer) {
          // SSR: SEO tags only — do not SSR episode body (avoids hydration mismatch with client).
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
              // Stay in loading on server so we don't emit a "not found" shell for hydration.
              this.isLoading.set(true);
            });
        } else {
          this.episodeService.GetEpisodeDetailsFromApi(episodeUuid, this.podcastName)
            .then(episode => {
              this.episode.set(episode);
              if (episode) {
                pageDetails = {
                  description: this.podcastName,
                  title: `${episode.episodeTitle} | ${this.podcastName}`,
                  releaseDate: episode.release.toString(),
                  duration: episode.duration
                };
              }
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
