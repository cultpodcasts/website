import { ChangeDetectionStrategy, Component } from "@angular/core";
import { SeriesHubComponent } from "../series-hub/series-hub.component";
import { SiteLoadingComponent } from "../site-loading/site-loading.component";
import { connectCatalogueHubSeo } from "../catalogue-hub-seo";

@Component({
  selector: "app-tv-show",
  imports: [SeriesHubComponent, SiteLoadingComponent],
  templateUrl: "./tv-show.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TvShowComponent {
  private readonly hubSeo = connectCatalogueHubSeo("tv");
  protected readonly slug = this.hubSeo.slug;

  ngOnInit(): void {
    this.hubSeo.start();
  }
}
