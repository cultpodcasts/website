import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { SeriesHubComponent } from "./series-hub.component";

@Component({
  selector: "app-news-organisation",
  imports: [SeriesHubComponent],
  templateUrl: "./news-organisation.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewsOrganisationComponent {
  protected readonly slug = signal("");
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.slug.set(this.route.snapshot.params["slug"] ?? "");
    this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.slug.set(params["slug"] ?? "");
    });
  }
}
