import { ChangeDetectionStrategy, Component } from "@angular/core";
import { SeriesHubComponent } from "../series-hub/series-hub.component";
import { SiteLoadingComponent } from "../site-loading/site-loading.component";
import { connectCatalogueHubSeo } from "../catalogue-hub-seo";

@Component({
  selector: "app-news-organisation",
  imports: [SeriesHubComponent, SiteLoadingComponent],
  templateUrl: "./news-organisation.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewsOrganisationComponent {
  private readonly hubSeo = connectCatalogueHubSeo("news");
  protected readonly slug = this.hubSeo.slug;

  ngOnInit(): void {
    this.hubSeo.start();
  }
}
