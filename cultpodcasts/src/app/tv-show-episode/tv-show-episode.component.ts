import { ChangeDetectionStrategy, Component, DestroyRef, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { MatButtonModule } from "@angular/material/button";
import { MatDialog } from "@angular/material/dialog";
import { MatSnackBar } from "@angular/material/snack-bar";
import { RouterLink } from "@angular/router";
import { EditEpisodeDialogResponse } from "../edit-episode-dialog-response.interface";
import { EditTvShowEpisodeCanonicalDialogComponent } from "../edit-tv-show-episode-canonical-dialog/edit-tv-show-episode-canonical-dialog.component";
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
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);
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

  /** Identity-only curator edit until a full TV-episode editor exists. */
  editIdentity(episodeId: string): void {
    const identityRef = this.dialog.open<
      EditTvShowEpisodeCanonicalDialogComponent,
      { episodeId: string },
      EditEpisodeDialogResponse
    >(EditTvShowEpisodeCanonicalDialogComponent, {
      data: { episodeId },
      disableClose: true,
      autoFocus: true,
      width: "90%",
    });
    identityRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      if (result?.updated) {
        this.snackBar.open("Episode updated", "Ok", { duration: 10000 });
      } else if (result?.noChange) {
        this.snackBar.open("No change", "Ok", { duration: 3000 });
      }
    });
  }
}
