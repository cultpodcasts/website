import { ChangeDetectionStrategy, Component } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { RouterLink } from "@angular/router";
import { SiteLoadingComponent } from "../site-loading/site-loading.component";
import { EpisodeLoadingSkeletonComponent } from "../episode-loading-skeleton/episode-loading-skeleton.component";
import { PodcastEpisodeComponent } from "../podcast-episode/podcast-episode.component";
import { connectKindEpisode } from "../kind-episode-page";

@Component({
  selector: "app-tv-show-episode",
  templateUrl: "./tv-show-episode.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    MatButtonModule,
    SiteLoadingComponent,
    EpisodeLoadingSkeletonComponent,
    PodcastEpisodeComponent,
  ],
})
export class TvShowEpisodeComponent {
  private readonly page = connectKindEpisode({
    parentHub: (slug) => slug ? ["/tv", slug] : null,
    seoName: (_episode, slug) => slug,
    contentKind: "TvShowEpisode",
  });
  protected readonly slug = this.page.slug;
  protected readonly episode = this.page.episode;
  protected readonly isLoading = this.page.isLoading;
  protected readonly isEpisode = this.page.isEpisode;
  protected readonly showEpisodeSkeleton = this.page.showEpisodeSkeleton;
  protected readonly parentHub = this.page.parentHub;
  protected readonly displayCatalogName = this.page.displayCatalogName;

  ngOnInit(): void {
    this.page.start();
  }
}
