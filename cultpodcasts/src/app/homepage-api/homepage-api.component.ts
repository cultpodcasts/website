import { Component, Inject, inject, PLATFORM_ID } from '@angular/core';
import { IHomepage } from '../IHomepage';
import { SiteService } from '../SiteService';
import { IHomepageItem } from '../IHomepageItem';
import { KeyValue, NgIf, NgFor, DecimalPipe, KeyValuePipe, formatDate, isPlatformServer } from '@angular/common';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs/internal/observable/combineLatest';
import { environment } from './../../environments/environment';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { GuidService } from '../guid.service';
import { HomepageService } from '../homepage.service';
import { waitFor } from '../core.module';

const pageSize: number = 20;
const pageParam: string = "page";

@Component({
  selector: 'app-homepage-api',
  standalone: true,
  imports: [
    NgIf,
    MatProgressBarModule,
    NgFor,
    MatCardModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    DecimalPipe,
    KeyValuePipe
  ],
  templateUrl: './homepage-api.component.html',
  styleUrl: './homepage-api.component.sass'
})
export class HomepageApiComponent {
  grouped: { [key: string]: IHomepageItem[]; };
  currentPage: number = 1;
  episodesThisWeek: number | undefined;
  errorText: string | undefined;
  isServer: boolean;

  prevPage: number = 0;
  nextPage: number = 0;

  isLoading: boolean = true;
  isInError: boolean = false;
  showPagingPrevious: boolean = false;
  showPagingPreviousInit: boolean = false;
  showPagingNext: boolean = false;

  Weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  Month = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

  homepage: IHomepage | undefined;
  totalDuration: string = "";
  totalEpisodes: number | undefined;

  constructor(
    private router: Router,
    private siteService: SiteService,
    private guidService: GuidService,
    private homepageService: HomepageService,
    @Inject(PLATFORM_ID) platformId: any,
  ) {
    console.log("homepage start")
    this.isServer = isPlatformServer(platformId);
    this.grouped = {};
    console.log("constructor finished")
  }
  private route = inject(ActivatedRoute);

  async ngOnInit(): Promise<any> {
    console.log("on-init start")
    await this.populatePage();
    console.log("on-init finished")
  }

  async populatePage(): Promise<any> {
    combineLatest(
      [this.route.params, this.route.queryParams],
      (params: Params, queryParams: Params) => ({
        params,
        queryParams,
      })
    ).subscribe(async (res: { params: Params; queryParams: Params }) => {
      console.log("subscribe start")
      const { params, queryParams } = res;

      this.siteService.setQuery(null);
      this.siteService.setPodcast(null);
      this.siteService.setSubject(null);

      this.currentPage = 1;
      if (queryParams[pageParam]) {
        this.currentPage = parseInt(queryParams[pageParam]);
        this.prevPage = this.currentPage - 1;
        this.nextPage = this.currentPage + 1;
      } else {
        this.nextPage = 2;
      }
      if (this.isServer) {
        try {
          this.isLoading = false;
console.log("get-preprocessed-homepage-from-api start")
          let homepageContent = await this.homepageService.getPreProcessedHomepageFromApi();
console.log("get-preprocessed-homepage-from-api finished")
          this.totalDuration = `${homepageContent.totalDurationDays} days`;
          this.grouped = homepageContent.episodesByDay;
          this.showPagingNext = homepageContent.hasNext;
          this.episodesThisWeek = homepageContent.episodesThisWeek;
          this.totalEpisodes = homepageContent.episodeCount;
        } catch (e) {
          console.error(e);
        }
      } else {
        try {
          let homepageContent: IHomepage | undefined;
          try {
            if (!homepageContent) {
              console.log("get-homepage-from-api start")
              homepageContent = await this.homepageService.getHomepageFromApi();
              console.log("get-homepage-from-api finished")
            }
          } catch (error) {
            this.errorText = JSON.stringify(error);
            console.error(error);
            this.isLoading = false;
            this.isInError = true;
          }
          if (homepageContent) {
            this.homepage = homepageContent;
            this.totalDuration = this.homepage.totalDuration.split(".")[0] + " days";
            let start = (this.currentPage - 1) * pageSize;
            this.episodesThisWeek = this.homepage.recentEpisodes.length;
            this.totalEpisodes = this.homepage.episodeCount;
            var pageEpisodes = this.homepage.recentEpisodes.slice(start, start + pageSize);
            this.grouped = pageEpisodes.reduce((group: { [key: string]: IHomepageItem[] }, item) => {
              if (!group[item.releaseDayDisplay]) {
                group[item.releaseDayDisplay] = [];
              }
              group[item.releaseDayDisplay].push(item);
              return group;
            }, {});
            this.isLoading = false;
            this.showPagingPrevious = this.currentPage > 2;
            this.showPagingPreviousInit = this.currentPage == 2;
            this.showPagingNext = (this.currentPage * pageSize) < this.homepage.recentEpisodes.length;
          } else {
            this.isLoading = false;
            this.isInError = true;
          }
        } catch (e) {
          console.error(e)
        }
      }
      console.log("subscribe finished")
    });
  }

  setPage(page: number) {
    var url = `/`;
    this.currentPage += page;
    var params: Params = {};
    if (this.currentPage > 1) {
      params["page"] = this.currentPage;
    }
    this.router.navigate([url], { queryParams: params });
  }

  share(item: IHomepageItem) {
    let description = `"${item.episodeTitle}" - ${item.podcastName}`;
    description = description + ", " + formatDate(item.release, 'mediumDate', 'en-US');
    description = description + " [" + item.length.split(".")[0].substring(1) + "]";
    const shortGuid = this.guidService.toBase64(item.episodeId);
    const share = {
      title: item.episodeTitle,
      text: description,
      url: `${environment.shortner}/${shortGuid}`
    };
    window.navigator.share(share);
  }
}
