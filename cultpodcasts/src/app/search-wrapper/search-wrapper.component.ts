import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SearchComponent } from "../search/search.component";

@Component({
    selector: 'app-search-wrapper',
    standalone: true,
    templateUrl: './search-wrapper.component.html',
    styleUrl: './search-wrapper.component.sass',
    imports: [SearchComponent],
    host: { ngSkipHydration: 'true' }
})
export class SearchWrapperComponent {
  isBrowser: boolean;
  constructor(@Inject(PLATFORM_ID) private platformId: any) {
    this.isBrowser = isPlatformBrowser(platformId);
  }
}
