import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { SeriesHubComponent } from "../series-hub/series-hub.component";
import { SiteLoadingComponent } from "../site-loading/site-loading.component";
import { SeoService } from "../seo.service";

@Component({
  selector: "app-tv-show",
  imports: [SeriesHubComponent, SiteLoadingComponent],
  templateUrl: "./tv-show.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TvShowComponent {
  protected readonly slug = signal("");
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly seo = inject(SeoService);

  ngOnInit(): void {
    this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const slug = params["slug"] ?? "";
      this.slug.set(slug);
      this.seo.AddMetaTags({ title: slug });
    });
  }
}
