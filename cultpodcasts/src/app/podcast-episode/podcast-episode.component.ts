import { Component, DestroyRef, inject, Input, ChangeDetectionStrategy, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { SearchResult } from '../search-result.interface';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { combineLatest } from 'rxjs';
import { EditEpisodeDialogComponent } from '../edit-episode-dialog/edit-episode-dialog.component';
import { SiteService } from '../site.service';
import { PostEpisodeDialogComponent } from '../post-episode-dialog/post-episode-dialog.component';
import { EpisodeImageComponent } from "../episode-image/episode-image.component";
import { EpisodeLinksComponent } from "../episode-links/episode-links.component";
import { BookmarkComponent } from "../bookmark/bookmark.component";
import { SubjectsComponent } from "../subjects/subjects.component";
import { EditEpisodeDialogResponse } from '../edit-episode-dialog-response.interface';
import { PostEpisodeDialogResponse } from '../post-episode-dialog-response.interface';
import { EpisodePublishResponseSnackbarComponent } from '../episode-publish-response-snackbar/episode-publish-response-snackbar.component';
import { SearchDescriptionPipe } from '../search-description.pipe';

@Component({
  selector: 'app-podcast-episode',
  imports: [
    MatButtonModule,
    MatMenuModule,
    MatIconModule,
    MatCardModule,
    RouterLink,
    DatePipe,
    EpisodeImageComponent,
    EpisodeLinksComponent,
    BookmarkComponent,
    SubjectsComponent,
    SearchDescriptionPipe
  ],
  templateUrl: './podcast-episode.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './podcast-episode.component.sass'
})
export class PodcastEpisodeComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthServiceWrapper);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly siteService = inject(SiteService);

  @Input()
  get episode(): SearchResult | undefined {
    return this._episode();
  }
  set episode(val: SearchResult | undefined) {
    this._episode.set(val);
    this.isLoading.set(false);
  }

  @Input()
  set parentLoaded(val: boolean) {
    this._parentLoaded = val;
    this.isLoading.set(!this._parentLoaded);
  }

  private _episode = signal<SearchResult | undefined>(undefined);
  private _parentLoaded: boolean = false;

  podcastName = signal("");
  protected readonly authRoles = toSignal(this.auth.roles, { initialValue: [] as string[] });
  protected readonly isSignedIn = toSignal(this.auth.isSignedIn, { initialValue: false });
  isLoading = signal(true);

  async ngOnInit(): Promise<any> {
    this.populatePage();
  }

  populatePage() {
    combineLatest(
      [this.route.params, this.route.queryParams],
      (params: Params, queryParams: Params) => ({ params, queryParams })
    ).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((res: { params: Params; queryParams: Params }) => {
      const { params } = res;
      this.podcastName.set(params["podcastName"]);
      this.siteService.setQuery(null);
      this.siteService.setPodcast(this.podcastName());
      this.siteService.setSubject(null);
    });
  }

  edit(podcastName: string, episodeId: string) {
    const dialogRef = this.dialog.open<EditEpisodeDialogComponent, any, EditEpisodeDialogResponse>(EditEpisodeDialogComponent, {
      data: { episodeId: episodeId, podcastIdentifier: podcastName },
      disableClose: true,
      autoFocus: true,
      width: '90%'
    });
    dialogRef.afterClosed().subscribe(async result => {
      let snackBarRef: MatSnackBarRef<TextOnlySnackBar> | undefined;
      if (result) {
        if (result.updated) {
          snackBarRef = this.snackBar.open("Episode updated", "Review", { duration: 10000 });
        } else if (result.noChange) {
          snackBarRef = this.snackBar.open("No change", "Review", { duration: 3000 });
        }
        if (snackBarRef) {
          snackBarRef.onAction().subscribe(() => {
            const episode = JSON.stringify([`${result.podcastId}/${episodeId}`]);
            this.router.navigate(["/episodes", episode])
          });
        }
      }
    });
  }

  podcastPage() {
    let url = `podcast/${this.podcastName()}`;
    this.router.navigate([url]);
  }

  post(podcastName: string, episodeId: string) {
    const dialogRef = this.dialog
      .open<PostEpisodeDialogComponent, any, PostEpisodeDialogResponse>(PostEpisodeDialogComponent, {
        data: { podcastIdentifier: podcastName, episodeId: episodeId },
        disableClose: true,
        autoFocus: true
      });
    dialogRef.afterClosed().subscribe(async result => {
      this.snackBar.openFromComponent(EpisodePublishResponseSnackbarComponent,
        { duration: 10000, data: { postEpisodeDialogResponse: result, podcastId: result?.response?.podcastId, episodeId: episodeId } });
    });
  }
}
