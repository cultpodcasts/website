import { Component, inject } from '@angular/core';
import { ISearchResult } from '../ISearchResult';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs/internal/observable/combineLatest';
import { SiteService } from '../SiteService';
import { ISearchState } from '../ISearchState';
import { ODataService } from '../OdataService'
import { environment } from './../../environments/environment';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { NgIf, NgClass, NgFor, DatePipe, formatDate } from '@angular/common';
import { GuidService } from '../guid.service';
import { AuthServiceWrapper } from '../AuthServiceWrapper';
import { EditEpisodeDialogComponent } from '../edit-episode-dialog/edit-episode-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { PodcastIndexComponent } from '../podcast-index/podcast-index.component';
import { EditPodcastDialogComponent } from '../edit-podcast-dialog/edit-podcast-dialog.component';
import { SubmitPodcastComponent } from '../submit-podcast/submit-podcast.component';
import { ShareMode } from '../ShareMode';
import { SendPodcastComponent } from '../send-podcast/send-podcast.component';
import { SubmitDialogResponse } from '../submit-url-origin-response';
import { IShare } from '../IShare';
import { RenamePodcastDialogComponent } from '../rename-podcast-dialog/rename-podcast-dialog.component';
import { PodcastTagsService } from '../podcast-tags.service';

const pageSize: number = 20;
const sortParam: string = "sort";
const pageParam: string = "page";
const sortParamRank: string = "rank";
const sortParamDateAsc: string = "date-asc";
const sortParamDateDesc: string = "date-desc";

@Component({
  selector: 'app-podcast-api',
  standalone: true,
  imports: [
    NgIf,
    MatProgressBarModule,
    MatButtonModule,
    MatMenuModule,
    MatIconModule,
    NgClass,
    NgFor,
    MatCardModule,
    RouterLink,
    DatePipe
  ],
  templateUrl: './podcast-api.component.html',
  styleUrl: './podcast-api.component.sass'
})
export class PodcastApiComponent {
  searchState: ISearchState = {
    query: "",
    episodeUuid: "",
    page: 1,
    sort: sortParamDateDesc,
    filter: null
  }

  podcastName: string = "";
  count: number = 0;
  prevPage: number = 0;
  nextPage: number = 0;
  sortParamRank: string = sortParamRank;
  sortParamDateAsc: string = sortParamDateAsc;
  sortParamDateDesc: string = sortParamDateDesc;
  results: ISearchResult[] = [];
  resultsHeading: string = "";
  isLoading: boolean = true;
  showPagingPrevious: boolean = false;
  showPagingNext: boolean = false;
  authRoles: string[] = [];

  constructor(
    private router: Router,
    private siteService: SiteService,
    private oDataService: ODataService,
    private guidService: GuidService,
    protected auth: AuthServiceWrapper,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private podcastTagsService: PodcastTagsService
  ) {
    this.auth.roles.subscribe(roles => this.authRoles = roles);
  }
  private route = inject(ActivatedRoute);

  async ngOnInit(): Promise<any> {
    this.initialiseBrowser();
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

  editPodcast() {
    const dialogRef = this.dialog.open(EditPodcastDialogComponent, {
      data: { podcastName: this.podcastName },
      disableClose: true,
      autoFocus: true
    });
    dialogRef.afterClosed().subscribe(async result => {
      if (result.updated) {
        let snackBarRef = this.snackBar.open("Podcast updated", "Ok", { duration: 10000 });
      } else if (result.noChange) {
        let snackBarRef = this.snackBar.open("No change", "Ok", { duration: 3000 });
      }
    });
  }

  initialiseBrowser() {
    combineLatest(
      [this.route.params, this.route.queryParams],
      (params: Params, queryParams: Params) => ({ params, queryParams })
    ).subscribe((res: { params: Params; queryParams: Params }) => {
      const { params, queryParams } = res;
      this.podcastName = params["podcastName"];
      this.populatePage(params, queryParams)
    });
  }

  populatePage(params: Params, queryParams: Params) {
    const episodeUuid = this.podcastTagsService.getEpisodeUuid(params["query"])
    let query = "";
    if (episodeUuid == "") {
      query = params["query"] ?? "";
    }
    this.isLoading = true;

    this.searchState.query = query;
    this.siteService.setQuery(this.searchState.query);
    this.searchState.episodeUuid = episodeUuid;
    this.siteService.setEpisodeUuid(this.searchState.episodeUuid);

    this.siteService.setPodcast(this.podcastName);
    this.siteService.setSubject(null);

    if (queryParams[pageParam]) {
      this.searchState.page = parseInt(queryParams[pageParam]);
      this.prevPage = this.searchState.page - 1;
      this.nextPage = this.searchState.page + 1;
    } else {
      this.nextPage = 2;
      this.searchState.page = 1;
    }

    if (queryParams[sortParam]) {
      this.searchState.sort = queryParams[sortParam];
    } else {
      if (this.searchState.query) {
        this.searchState.sort = sortParamRank;
      } else {
        this.searchState.sort = sortParamDateDesc;
      }
    }

    this.searchState.filter = `(podcastName eq '${this.podcastName.replaceAll("'", "''")}')`;
    if (this.searchState.episodeUuid) {
      this.searchState.filter += ` and (id eq '${this.searchState.episodeUuid}')`;
    }
    this.siteService.setFilter(this.searchState.filter);

    let currentTime = Date.now();
    var sort: string = "";
    if (this.searchState.sort == "date-asc") {
      sort = "release asc";
    } else if (this.searchState.sort == "date-desc") {
      sort = "release desc";
    }

    this.oDataService.getEntities<ISearchResult>(
      new URL("/search", environment.api).toString(),
      {
        search: this.searchState.query,
        filter: this.searchState.filter,
        searchMode: 'any',
        queryType: 'simple',
        count: true,
        skip: (this.searchState.page - 1) * pageSize,
        top: pageSize,
        facets: ["podcastName,count:10,sort:count", "subjects,count:10,sort:count"],
        orderby: sort
      }).subscribe(
        {
          next: data => {
            this.results = data.entities;
            var requestTime = (Date.now() - currentTime) / 1000;
            const count = data.metadata.get("count");
            this.count = count;
            this.isLoading = false;
            this.showPagingPrevious = this.searchState.page != undefined && this.searchState.page > 1;
            this.showPagingNext = (this.searchState.page * pageSize) < count;
          },
          error: (e) => {
            this.resultsHeading = "Something went wrong. Please try again.";
            this.isLoading = false;
          }
        });
  }

  setSort(sort: string) {
    var url = `/podcast/${this.podcastName}`;
    var query = this.siteService.getSiteData().query;
    if (query && query != "") {
      url = `${url}/${query}`;
    }
    var params: Params = {};
    if (this.searchState.query) {
      if (sort != sortParamRank) {
        params[sortParam] = sort;
      }
    } else {
      if (sort != sortParamDateDesc) {
        params[sortParam] = sort;
      }
    }
    this.router.navigate([url], { queryParams: params });
  }

  setPage(page: number) {
    var url = `/podcast/${this.podcastName}`;
    if (this.searchState.query && this.searchState.query != "") {
      url += "/" + this.searchState.query;
    }
    this.searchState.page += page;
    var params: Params = {};
    if (this.searchState.page != null && this.searchState.page > 1) {
      params["page"] = this.searchState.page;
    }
    if (this.searchState.query) {
      if (this.searchState.sort != sortParamRank) {
        params[sortParam] = this.searchState.sort;
      }
    } else {
      if (this.searchState.sort != sortParamDateDesc) {
        params[sortParam] = this.searchState.sort;
      }
    }
    this.router.navigate([url], { queryParams: params });
  }

  search() {
    let url = `search/${this.podcastName}`;
    if (this.searchState.query) {
      url += ` ${this.searchState.query}`;
    }
    this.router.navigate([url]);
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

  index() {
    const dialogRef = this.dialog.open(PodcastIndexComponent, { disableClose: true, autoFocus: true });
    dialogRef.componentInstance.index(this.results[0].podcastName);
    dialogRef.afterClosed().subscribe(async result => {
      if (result.updated) {
        let message = "Podcast Indexed";
        let action = "Ok";
        if (result.episodeIds && result.episodeIds.length > 0) {
          message += `. ${result.episodeIds.length} episode${result.episodeIds.length > 1 ? 's' : ''} updated`;
          action = "Review";
        }
        let snackBarRef = this.snackBar.open(message, action, { duration: 10000 });
        if (result.episodeIds && result.episodeIds.length > 0) {
          snackBarRef.onAction().subscribe(() => {
            const episodeId = JSON.stringify(result.episodeIds);
            this.router.navigate(["/episodes", episodeId])
          });
        }
      } else if (result.podcastNotAutoIndex) {
        let snackBarRef = this.snackBar.open("Podcast not indexable", "Ok", { duration: 10000 });
      } else if (result.podcastNotFound) {
        let snackBarRef = this.snackBar.open("Podcast not found", "Ok", { duration: 10000 });
      }
    });
  }

  submitUrlForPodcast() {
    this.dialog
      .open(SubmitPodcastComponent, { disableClose: true, autoFocus: true })
      .afterClosed()
      .subscribe(async result => {
        if (result?.url) {
          await this.sendPodcast({ url: result.url, podcastName: this.podcastName, podcastId: undefined, shareMode: ShareMode.Text });
        }
      });
  }

  async sendPodcast(share: IShare) {
    const dialog = this.dialog.open<SendPodcastComponent, any, SubmitDialogResponse>(SendPodcastComponent, { disableClose: true, autoFocus: true });
    dialog
      .afterClosed()
      .subscribe(result => {
        if (result && result.submitted) {
          if (result.originResponse?.success != null) {
            let episode: string;
            let edit: boolean = false;
            if (result.originResponse.success.episode === "Created") {
              episode = "Episode created.";
              edit = true;
            } else if (result.originResponse.success.episode === "Enriched") {
              episode = "Episode enriched.";
              edit = true;
            } else if (result.originResponse.success.episode === "Ignored") {
              episode = "Episode ignored.";
            } else if (result.originResponse.success.episode === "EpisodeAlreadyExists") {
              episode = "Episode already exists.";
              edit = true;
            } else {
              episode = "Episode not created.";
            }
            let snackBarRef = this.snackBar.open(`Podcast Sent direct to database. ${episode}`, edit ? "Edit" : "Ok", { duration: 10000 });

            if (edit) {
              snackBarRef.onAction().subscribe(() => {
                this.edit(result.originResponse!.success!.episodeId!)
              });
            }
          } else {
            let snackBarRef = this.snackBar.open('Podcast Sent!', "Ok", { duration: 3000 });
          }
        }
      });
    await dialog.componentInstance.submit(share);
  }

  renamePodcast() {
    const dialogRef = this.dialog.open(RenamePodcastDialogComponent, {
      data: { podcastName: this.podcastName },
      disableClose: true,
      autoFocus: true
    });
    dialogRef.afterClosed().subscribe(async result => {
      let snackBarRef: MatSnackBarRef<TextOnlySnackBar> | undefined;
      const indexUpdated = result?.indexUpdated ? "" : " not";
      if (result.updated) {
        snackBarRef = this.snackBar.open(`Podcast name changed to "${result.newPodcastName}". Index ${indexUpdated} updated.`, "Review", { duration: 10000 });
      } else if (result.noChange) {
        snackBarRef = this.snackBar.open("No change", "Ok", { duration: 3000 });
      }
      if (result.updated && snackBarRef) {
        snackBarRef.onAction().subscribe(() => {
          this.router.navigate(["/podcast", result.newPodcastName])
        });
      }
    });
  }

}
