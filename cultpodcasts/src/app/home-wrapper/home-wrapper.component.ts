import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { HomeComponent } from "../home/home.component";
import { isPlatformBrowser } from '@angular/common';

@Component({
    selector: 'app-home-wrapper',
    standalone: true,
    templateUrl: './home-wrapper.component.html',
    styleUrl: './home-wrapper.component.sass',
    imports: [HomeComponent],
    host: { ngSkipHydration: 'true' }
})
export class HomeWrapperComponent {
  isBrowser: boolean;
  constructor(@Inject(PLATFORM_ID) private platformId: any) {
    this.isBrowser = isPlatformBrowser(platformId);
  }
}
