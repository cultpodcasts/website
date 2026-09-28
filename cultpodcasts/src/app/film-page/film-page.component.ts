import { ChangeDetectionStrategy, Component } from "@angular/core";
import { SiteLoadingComponent } from "../site-loading/site-loading.component";
import { EpisodeLoadingSkeletonComponent } from "../episode-loading-skeleton/episode-loading-skeleton.component";
import { connectKindEpisode } from "../kind-episode-page";

@Component({
  selector: "app-film-page",
  templateUrl: "./film-page.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SiteLoadingComponent, EpisodeLoadingSkeletonComponent],
})
export class FilmPageComponent {
  private readonly page = connectKindEpisode({
    parentHub: () => null,
    seoName: (episode) => episode.episodeTitle || "Film",
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
