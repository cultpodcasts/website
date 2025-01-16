import { Component, inject, Input } from '@angular/core';
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
    SubjectsComponent
  ],
  templateUrl: './podcast-episode.component.html',
  styleUrl: './podcast-episode.component.sass'
})
export class PodcastEpisodeComponent {

  @Input()
  get episode(): SearchResult | undefined {
    return this._episode;
  }
  set episode(val: SearchResult | undefined) {
    this._episode = val;
    this.isLoading = false;
  }

  @Input()
  set parentLoaded(val: boolean) {
    this._parentLoaded = val;
    this.isLoading = !this._parentLoaded;
  }

  private _episode: SearchResult | undefined;
  private _parentLoaded: boolean = false;

  podcastName: string = "";
  resultsHeading: string = "";
  authRoles: string[] = [];
  isSignedIn: boolean = false;
  isLoading: boolean = true;

  constructor(
    private router: Router,
    protected auth: AuthServiceWrapper,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private siteService: SiteService,
  ) {
    this.auth.roles.subscribe(roles => this.authRoles = roles);
    this.auth.isSignedIn.subscribe(isSignedIn => this.isSignedIn = isSignedIn);
  }
  private route = inject(ActivatedRoute);

  async ngOnInit(): Promise<any> {
    this.populatePage();
  }

  populatePage() {
    combineLatest(
      [this.route.params, this.route.queryParams],
      (params: Params, queryParams: Params) => ({ params, queryParams })
    ).subscribe((res: { params: Params; queryParams: Params }) => {
      const { params, queryParams } = res;
      this.podcastName = params["podcastName"];
      this.siteService.setQuery(null);
      this.siteService.setPodcast(this.podcastName);
      this.siteService.setSubject(null);
    });
  }

  edit(id: string) {
    const dialogRef = this.dialog.open<EditEpisodeDialogComponent, any, EditEpisodeDialogResponse>(EditEpisodeDialogComponent, {
      data: { episodeId: id },
      disableClose: true,
      autoFocus: true
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
            const episodeId = JSON.stringify([id]);
            this.router.navigate(["/episodes", episodeId])
          });
        }
      }
    });
  }

  podcastPage() {
    let url = `podcast/${this.podcastName}`;
    this.router.navigate([url]);
  }

  post(id: string) {
    const dialogRef = this.dialog
      .open<PostEpisodeDialogComponent, any, PostEpisodeDialogResponse>(PostEpisodeDialogComponent, {
        data: { episodeId: id },
        disableClose: true,
        autoFocus: true
      });
    dialogRef.afterClosed().subscribe(async result => {
      this.snackBar.openFromComponent(EpisodePublishResponseSnackbarComponent,
        { duration: 10000, data: { postEpisodeDialogResponse: result, episodeId: id } });
    });
  }
}
