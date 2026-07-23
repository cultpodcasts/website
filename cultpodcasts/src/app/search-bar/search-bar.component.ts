import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SearchBoxMode } from '../search-box-mode.enum';
import { Router } from '@angular/router';
import { SiteService } from '../site.service';
import { MatButtonModule } from '@angular/material/button';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { TextFieldModule } from '@angular/cdk/text-field';

@Component({
  selector: 'app-search-bar',
  imports: [
    MatButtonModule,
    FormsModule,
    MatFormFieldModule,
    MatChipsModule,
    MatInputModule,
    MatIconModule,
    TextFieldModule
  ],
  templateUrl: './search-bar.component.html',
  styleUrl: './search-bar.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class SearchBarComponent {
  protected readonly searchChip = signal<string | null>(null);
  protected readonly searchBoxMode = signal(SearchBoxMode.Default);

  @ViewChild('searchBox', { static: true })
  searchBox: ElementRef | undefined;

  constructor(
    private router: Router,
    private siteService: SiteService) {
    this.siteService.currentSiteData
      .pipe(takeUntilDestroyed())
      .subscribe(siteData => {
        if (this.searchBox) {
          this.searchBox.nativeElement.value = siteData.query ?? "";
          if (siteData.podcast != null) {
            this.searchChip.set(siteData.podcast);
            this.searchBoxMode.set(SearchBoxMode.Podcast);
          } else if (siteData.subject != null) {
            this.searchChip.set(siteData.subject);
            this.searchBoxMode.set(SearchBoxMode.Subject);
          } else {
            this.searchChip.set(null);
            this.searchBoxMode.set(SearchBoxMode.Default);
          }
        }
      });
  }

  search = (input: HTMLInputElement) => {
    input.blur();
    const chip = this.searchChip();
    if (chip) {
      if (this.searchBoxMode() == SearchBoxMode.Podcast) {
        this.router.navigate(['/podcast/' + chip + "/" + input.value]);
      } else if (this.searchBoxMode() == SearchBoxMode.Subject) {
        this.router.navigate(['/subject/' + chip + "/" + input.value]);
      }
    } else {
      this.router.navigate(['/search/' + input.value]);
    }
  };

  removeSearchChip() {
    this.searchChip.set(null);
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
