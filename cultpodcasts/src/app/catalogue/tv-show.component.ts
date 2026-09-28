import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { DestroyRef } from "@angular/core";
import { SeriesHubComponent } from "./series-hub.component";

@Component({
  selector: "app-tv-show",
  imports: [SeriesHubComponent],
  templateUrl: "./tv-show.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TvShowComponent {
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
