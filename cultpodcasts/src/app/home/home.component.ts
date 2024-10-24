import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { IHomepage } from '../IHomepage';
import { SiteService } from '../SiteService';
import { IHomepageItem } from '../IHomepageItem';
import { KeyValue, NgIf, NgFor, DecimalPipe, KeyValuePipe, formatDate } from '@angular/common';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs/internal/observable/combineLatest';
import { environment } from './../../environments/environment';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { GuidService } from '../guid.service';

const pageSize: number = 20;
const pageParam: string = "page";

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.sass'],
  standalone: true,
  imports: [NgIf, MatProgressBarModule, NgFor, MatCardModule, RouterLink, MatButtonModule, MatIconModule, DecimalPipe, KeyValuePipe],
  host: { ngSkipHydration: 'true' }
})
export class HomeComponent {
  grouped: { [key: string]: IHomepageItem[]; };
  currentPage: number = 1;
  podcastCount: number | undefined;
  constructor(
    private router: Router,
    private http: HttpClient,
    private siteService: SiteService,
    private guidService: GuidService) {
    this.grouped = {};
  }
  private route = inject(ActivatedRoute);

  prevPage: number = 0;
  nextPage: number = 0;

  isLoading: boolean = true;
  isInError: boolean = false;
  showPagingPrevious: boolean = false;
  showPagingPreviousInit: boolean = false;
  showPagingNext: boolean = false;

  Weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  Month = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

  ToDate = (dateStr: string) => {
    const [day, month, year] = dateStr.split("/")
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  }

  descDate = (a: KeyValue<string, IHomepageItem[]>, b: KeyValue<string, IHomepageItem[]>): number => {
    var aD = this.ToDate(a.key);
    var bD = this.ToDate(b.key);
    if (aD > bD) {
      return -1;
    }
    if (aD < bD) {
      return 1
    }
    return 0;
  }

  homepage: IHomepage | undefined;
  totalDuration: string = "";

  ngOnInit() {
    combineLatest(
      [this.route.params, this.route.queryParams],
      (params: Params, queryParams: Params) => ({
        params,
        queryParams,
      })
    ).subscribe((res: { params: Params; queryParams: Params }) => {
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

      let homepage = this.http.get<IHomepage>(new URL("/homepage", environment.api).toString())
        .subscribe({
          next: data => {
            this.homepage = data;
            this.totalDuration = data.totalDuration.split(".")[0] + " days";
            let start = (this.currentPage - 1) * pageSize;
            this.podcastCount = data.recentEpisodes.length;
            var pageEpisodes = data.recentEpisodes.slice(start, start + pageSize);
            this.grouped = pageEpisodes.reduce((group: { [key: string]: IHomepageItem[] }, item) => {
              item.release = new Date(item.release);
              if (!group[item.release.toLocaleDateString()]) {
                group[item.release.toLocaleDateString()] = [];
              }
              group[item.release.toLocaleDateString()].push(item);
              return group;
            }, {});
            this.isLoading = false;
            this.showPagingPrevious = this.currentPage > 2;
            this.showPagingPreviousInit = this.currentPage == 2;
            this.showPagingNext = (this.currentPage * pageSize) < this.homepage.recentEpisodes.length;
          },
          error: e => {
            this.isLoading = false;
            this.isInError = true;
          }
        });
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
