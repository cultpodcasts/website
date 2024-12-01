import { Component, Inject, inject, PLATFORM_ID } from '@angular/core';
import { IHomepage } from '../IHomepage';
import { SiteService } from '../SiteService';
import { KeyValue, DecimalPipe, KeyValuePipe, isPlatformServer } from '@angular/common';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs/internal/observable/combineLatest';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { GuidService } from '../guid.service';
import { HomepageService } from '../homepage.service';
import { EpisodeImageComponent } from '../episode-image/episode-image.component';
import { IEpisode } from '../IEpisode';
import { EpisodeLinksComponent } from "../episode-links/episode-links.component";

@Component({
  selector: 'app-homepage-api',
  imports: [
    MatProgressBarModule,
    MatCardModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    DecimalPipe,
    KeyValuePipe,
    EpisodeImageComponent,
    EpisodeLinksComponent
],
  templateUrl: './homepage-api.component.html',
  styleUrl: './homepage-api.component.sass'
})
export class HomepageApiComponent {
  grouped: { [key: string]: IEpisode[]; };
  podcastCount: number | undefined;
  errorText: string | undefined;
  isServer: boolean;

  isLoading: boolean = true;
  isInError: boolean = false;
  showPagingPrevious: boolean = false;
  showPagingPreviousInit: boolean = false;
  showPagingNext: boolean = false;

  Weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  Month = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

  homepage: IHomepage | undefined;
  totalDuration: string = "";

  constructor(
    private router: Router,
    private siteService: SiteService,
    private guidService: GuidService,
    private homepageService: HomepageService,
    @Inject(PLATFORM_ID) platformId: any,
  ) {
    this.isServer = isPlatformServer(platformId);
    this.grouped = {};
  }
  private route = inject(ActivatedRoute);

  ngOnInit() {
    this.populatePage();
  }

  populatePage() {
    combineLatest(
      [this.route.params, this.route.queryParams],
      (params: Params, queryParams: Params) => ({
        params,
        queryParams,
      })
    ).subscribe(async (res: { params: Params; queryParams: Params }) => {
      const { params, queryParams } = res;

      this.siteService.setQuery(null);
      this.siteService.setPodcast(null);
      this.siteService.setSubject(null);

      let homepageContent: IHomepage | undefined;
      try {
        if (!homepageContent) {
          homepageContent = await this.homepageService.getHomepageFromApi()
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
        this.podcastCount = this.homepage.recentEpisodes.length;
        this.grouped = this.homepage.recentEpisodes.reduce((group: { [key: string]: IEpisode[] }, item) => {
          item.release = new Date(item.release);
          if (!group[item.release.toLocaleDateString()]) {
            group[item.release.toLocaleDateString()] = [];
          }
          group[item.release.toLocaleDateString()].push(item);
          return group;
        }, {});
        this.isLoading = false;
      } else {
        this.isLoading = false;
        this.isInError = true;
      }
    });
  }

  ToDate = (dateStr: string) => {
    const [day, month, year] = dateStr.split("/")
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  }

  descDate = (a: KeyValue<string, IEpisode[]>, b: KeyValue<string, IEpisode[]>): number => {
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
}
