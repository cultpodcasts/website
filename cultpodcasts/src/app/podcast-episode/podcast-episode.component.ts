import { Component, inject, Input } from '@angular/core';
import { ISearchResult } from '../ISearchResult';
import { DatePipe, formatDate, NgFor, NgIf } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { AuthServiceWrapper } from '../AuthServiceWrapper';
import { GuidService } from '../guid.service';
import { combineLatest } from 'rxjs';
import { EditEpisodeDialogComponent } from '../edit-episode-dialog/edit-episode-dialog.component';
import { environment } from './../../environments/environment';
import { SiteService } from '../SiteService';
import { PostEpisodeDialogComponent } from '../post-episode-dialog/post-episode-dialog.component';
import { EpisodePublishResponse } from '../episode-publish-response';
import { PostEpisodeModel } from '../post-episode-model';
import { EpisodePublishResponseAdaptor } from '../episode-publish-response-adaptor';

@Component({
  selector: 'app-podcast-episode',
  imports: [
    NgIf,
    MatButtonModule,
    MatMenuModule,
    MatIconModule,
    NgFor,
    MatCardModule,
    RouterLink,
    DatePipe
  ],
  templateUrl: './podcast-episode.component.html',
  styleUrl: './podcast-episode.component.sass'
})
export class PodcastEpisodeComponent {

  @Input()
  get episode(): ISearchResult | undefined {
    return this._episode;
  }
  set episode(val: ISearchResult | undefined) {
    this._episode = val;
    this.isLoading = false;
  }

  @Input()
  set parentLoaded(val: boolean) {
    this._parentLoaded = val;
    this.isLoading = !this._parentLoaded;
  }

  private _episode: ISearchResult | undefined;
  private _parentLoaded: boolean = false;

  podcastName: string = "";
  resultsHeading: string = "";
  authRoles: string[] = [];
  isLoading: boolean = true;

  constructor(
    private router: Router,
    private guidService: GuidService,
    protected auth: AuthServiceWrapper,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private siteService: SiteService,
  ) {
    this.auth.roles.subscribe(roles => this.authRoles = roles);
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
    const dialogRef = this.dialog.open(EditEpisodeDialogComponent, {
      data: { episodeId: id },
      disableClose: true,
      autoFocus: true
    });
    dialogRef.afterClosed().subscribe(async result => {
      let snackBarRef: MatSnackBarRef<TextOnlySnackBar> | undefined;
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
    });
  }

  share(item: ISearchResult) {
    let description = `"${item.episodeTitle}" - ${item.podcastName}`;
    description = description + ", " + formatDate(item.release, 'mediumDate', 'en-US');
    description = description + " [" + item.duration.split(".")[0].substring(1) + "]";
    const shortGuid = this.guidService.toBase64(item.id);
    const share = {
      title: item.episodeTitle,
      text: description,
      url: `${environment.shortner}/${shortGuid}`
    };
    window.navigator.share(share);
  }

  podcastPage() {
    let url = `podcast/${this.podcastName}`;
    this.router.navigate([url]);
  }

  post(id: string) {
    const dialogRef = this.dialog.open<PostEpisodeDialogComponent, any, {
      response?: EpisodePublishResponse,
      expectation?: PostEpisodeModel,
      noChange?: boolean
    }>(PostEpisodeDialogComponent, {
      data: { episodeId: id },
      disableClose: true,
      autoFocus: true
    });
    dialogRef.afterClosed().subscribe(async result => {
      if (result!.noChange) {
        let snackBarRef = this.snackBar.open("No change made", "Ok", { duration: 10000 });
      } else if (result?.response && result.expectation) {
        var messageBuilde = new EpisodePublishResponseAdaptor();
        const message = messageBuilde.createMessage(result.response, result.expectation);
        let snackBarRef = this.snackBar.open(message, "Ok", { duration: 10000 });
      }
    });
  }
}
