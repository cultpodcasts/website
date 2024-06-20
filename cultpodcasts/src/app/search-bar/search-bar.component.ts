import { Component, ElementRef, Inject, PLATFORM_ID, ViewChild } from '@angular/core';
import { SearchBoxMode } from '../SearchBoxMode';
import { Router } from '@angular/router';
import { SiteService } from '../SiteService';
import { NgIf, isPlatformBrowser } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [NgIf, MatButtonModule, FormsModule, MatFormFieldModule, MatChipsModule, MatInputModule, MatIconModule],
  templateUrl: './search-bar.component.html',
  styleUrl: './search-bar.component.sass',
  host: { ngSkipHydration: 'true' }
})

export class SearchBarComponent {
  searchChip: string | null = null;
  searchBoxMode: SearchBoxMode = SearchBoxMode.Default;

  @ViewChild('searchBox', { static: true })
  searchBox: ElementRef | undefined;
  isBrowser: boolean;

  constructor(
    private router: Router,
    private siteService: SiteService,
    @Inject(PLATFORM_ID) private platformId: any) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit() {
    this.siteService.currentSiteData.subscribe(siteData => {
      if (this.searchBox) {
        this.searchBox.nativeElement.value = siteData.query;
        if (siteData.podcast != null) {
          this.searchChip = siteData.podcast;
          this.searchBoxMode = SearchBoxMode.Podcast;
        } else if (siteData.subject != null) {
          this.searchChip = siteData.subject;
          this.searchBoxMode = SearchBoxMode.Subject;
        } else {
          this.searchChip = null;
          this.searchBoxMode = SearchBoxMode.Default;
        }
      };
    });
  }

  search = (input: HTMLInputElement) => {
    input.blur();
    if (this.searchChip) {
      if (this.searchBoxMode == SearchBoxMode.Podcast) {
        this.router.navigate(['/podcast/' + this.searchChip + "/" + input.value]);
      } else if (this.searchBoxMode == SearchBoxMode.Subject) {
        this.router.navigate(['/subject/' + this.searchChip + "/" + input.value]);
      }
    } else {
      this.router.navigate(['/search/' + input.value]);
    }
  };

  removeSearchChip() {
    this.searchChip = null;
    var query = this.siteService.getSiteData().query;
    if (query && query != "") {
      const url = `/search/` + query;
      this.router.navigate([url]);
    } else {
      const url = `/`;
      this.router.navigate([url]);
    }
  }


}
