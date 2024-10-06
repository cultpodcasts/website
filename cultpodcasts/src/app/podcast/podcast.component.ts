import { Component, Inject, Optional, PLATFORM_ID, inject } from '@angular/core';
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
import { NgIf, NgClass, NgFor, DatePipe, isPlatformBrowser, isPlatformServer, formatDate } from '@angular/common';
import { SeoService } from '../seo.service';
import { GuidService } from '../guid.service';
import { ShortnerRecord } from '../shortner-record';
import { KVNamespace } from '@cloudflare/workers-types';
import { firstValueFrom } from 'rxjs';
import { waitFor } from '../core.module';
import { AuthServiceWrapper } from '../AuthServiceWrapper';
import { EditEpisodeDialogComponent } from '../edit-episode-dialog/edit-episode-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PodcastIndexComponent } from '../podcast-index/podcast-index.component';
import { EditPodcastDialogComponent } from '../edit-podcast-dialog/edit-podcast-dialog.component';
import { SubmitPodcastComponent } from '../submit-podcast/submit-podcast.component';
import { ShareMode } from '../ShareMode';
import { SendPodcastComponent } from '../send-podcast/send-podcast.component';
import { SubmitDialogResponse } from '../submit-url-origin-response';
import { IShare } from '../IShare';

const pageSize: number = 20;
const sortParam: string = "sort";
const pageParam: string = "page";
const sortParamRank: string = "rank";
const sortParamDateAsc: string = "date-asc";
const sortParamDateDesc: string = "date-desc";

@Component({
  selector: 'app-podcast',
  templateUrl: './podcast.component.html',
  styleUrls: ['./podcast.component.sass'],
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
  host: { ngSkipHydration: 'true' }
})

export class PodcastComponent {
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
  isBrowser: any;
  isServer: boolean;
  results: ISearchResult[] = [];
  resultsHeading: string = "";
  isLoading: boolean = true;
  showPagingPrevious: boolean = false;
  showPagingNext: boolean = false;

  constructor(
    private router: Router,
    private siteService: SiteService,
    private oDataService: ODataService,
    private guidService: GuidService,
    protected auth: AuthServiceWrapper,
    private snackBar: MatSnackBar,
    @Inject(PLATFORM_ID) platformId: any,
    private seoService: SeoService,
    private dialog: MatDialog,
    @Optional() @Inject('kv') private kv: KVNamespace
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.isServer = isPlatformServer(platformId);
  }
  private route = inject(ActivatedRoute);

  async ngOnInit(): Promise<any> {
    if (this.isServer) {
      waitFor(this.initialiseServer());
    } else {
      this.initialiseBrowser();
    }
  }

  getEpisodeUuid(queryParam: string): string {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuid.test(queryParam)) {
      return queryParam;
    } else {
      return "";
    }
  }

  edit(id: string) {
    const dialogRef = this.dialog.open(EditEpisodeDialogComponent, {
      data: { episodeId: id },
      disableClose: true,
      autoFocus: true
    });
    dialogRef.afterClosed().subscribe(async result => {
      if (result.updated) {
        let snackBarRef = this.snackBar.open("Episode updated", "Ok", { duration: 10000 });
      } else if (result.noChange) {
        let snackBarRef = this.snackBar.open("No change", "Ok", { duration: 3000 });
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

  async initialiseServer(): Promise<any> {
    const params = await firstValueFrom(this.route.params);
    this.podcastName = params["podcastName"];
    await this.populateTags(params);
  }

  async populateTags(params: Params): Promise<any> {
    const episodeUuid = this.getEpisodeUuid(params["query"]);
    let episodeTitle: string | undefined = undefined;
    if (episodeUuid != "") {
      const key = this.guidService.toBase64(episodeUuid);
      try {
        const episodeKvWithMetaData = await this.kv.getWithMetadata<ShortnerRecord>(key);
        if (episodeKvWithMetaData != null && episodeKvWithMetaData.metadata != null) {
          episodeTitle = episodeKvWithMetaData.metadata.episodeTitle;
          if (episodeTitle) {
            this.seoService.AddMetaTags({
              description: this.podcastName,
              title: `${episodeTitle} | ${this.podcastName}`,
              releaseDate: episodeKvWithMetaData.metadata.releaseDate,
              duration: episodeKvWithMetaData.metadata.duration
            });
            console.log("Added meta-tags from kv");
          } else {
            this.seoService.AddMetaTags({ title: this.podcastName });
            console.log("No episode name in kv");
          }
        } else {
          console.log("No entry in kv");
          var episodeQuery = {
            "search": "",
            "filter": `(id eq '${episodeUuid}')`,
            "searchMode": "any",
            "queryType": "simple",
            "count": false,
            "skip": 0,
            "top": 20,
            "facets": [],
            "orderby": "release desc"
          };
          const url = new URL("/search", environment.api).toString();
          let result = await fetch(url, {
            method: "POST",
            body: JSON.stringify(episodeQuery)
          });
          if (result.status == 200) {
            const body: any = await result.json();
            if (body.value && body.value.length == 1) {
              const episode = body.value[0];
              this.seoService.AddMetaTags({
                description: this.podcastName,
                title: `${episode.episodeTitle} | ${this.podcastName}`,
                releaseDate: episode.release.toString(),
                duration: episode.duration
              });
              const shortnerRecord: ShortnerRecord = {
                episodeTitle: episode.episodeTitle,
                releaseDate: episode.release.split('T')[0],
                duration: episode.duration
              };
              const encodedPodcastName =
                encodeURIComponent(episode.podcastName)
                  .replaceAll("(", "%28")
                  .replaceAll(")", "%29");
              this.kv.put(key, encodedPodcastName + "/" + episode.id, { metadata: shortnerRecord });
            }
          }
        }
      } catch (error) {
        console.error(error);
        this.seoService.AddMetaTags({ title: this.podcastName });
      }
    } else {
      this.seoService.AddMetaTags({ title: this.podcastName });
    }
  }

  populatePage(params: Params, queryParams: Params) {
    const episodeUuid = this.getEpisodeUuid(params["query"])
    let query = "";
    if (episodeUuid == "") {
      this.seoService.AddMetaTags({ title: this.podcastName });
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
        if (result.episodeIds && result.episodeIds.length > 0) {
          message += `. ${result.episodeIds.length} episode${result.episodeIds.length > 1 ? 's' : ''} updated`;
        }
        let snackBarRef = this.snackBar.open(message, "Ok", { duration: 10000 });
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
            } else {
              episode = "Episode not created.";
            }
            let podcast = "";
            if (result.originResponse.success.podcast === "Created") {
              podcast = "Podcast created.";
            } else if (result.originResponse.success.podcast === "Enriched") {
              podcast = "Podcast enriched.";
            } else if (result.originResponse.success.podcast === "Ignored") {
              podcast = "Podcast ignored.";
            } else if (result.originResponse.success.podcast === "PodcastRemoved") {
              podcast = "Podcast Removed.";
            }
            let snackBarRef = this.snackBar.open(`Podcast Sent direct to database. ${podcast} ${episode}`, edit ? "Edit" : "Ok", { duration: 10000 });

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
}
