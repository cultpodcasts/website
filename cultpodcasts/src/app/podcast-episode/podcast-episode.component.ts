import { Component, inject, Input } from '@angular/core';
import { ISearchResult } from '../ISearchResult';
import { DatePipe, formatDate, NgClass, NgFor, NgIf } from '@angular/common';
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

@Component({
  selector: 'app-podcast-episode',
  standalone: true,
  imports: [
    NgIf,
    MatButtonModule,
    MatMenuModule,
    MatIconModule,
    NgClass,
    NgFor,
    MatCardModule,
    RouterLink,
    DatePipe
  ],
  templateUrl: './podcast-episode.component.html',
  styleUrl: './podcast-episode.component.sass'
})
export class PodcastEpisodeComponent {
  @Input() episode!: ISearchResult | undefined;

  podcastName: string = "";
  resultsHeading: string = "";
  authRoles: string[] = [];

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

  search() {
    let url = `search/${this.podcastName}`;
    this.router.navigate([url]);
  }
}
