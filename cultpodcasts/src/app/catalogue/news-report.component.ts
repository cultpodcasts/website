import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterLink } from "@angular/router";
import { MatButtonModule } from "@angular/material/button";
import { SiteLoadingComponent } from "../site-loading/site-loading.component";
import { EpisodeLoadingSkeletonComponent } from "../episode-loading-skeleton/episode-loading-skeleton.component";
import { connectKindEpisode } from "./kind-episode-page";

@Component({
  selector: "app-news-report",
  templateUrl: "./news-report.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, SiteLoadingComponent, EpisodeLoadingSkeletonComponent],
})
export class NewsReportComponent {
  private readonly page = connectKindEpisode({
    parentHub: (slug) => slug ? ["/news", slug] : null,
    seoName: (_episode, slug) => slug,
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
