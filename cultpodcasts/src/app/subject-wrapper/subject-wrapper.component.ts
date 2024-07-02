import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { SubjectComponent } from "../subject/subject.component";
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-subject-wrapper',
  standalone: true,
  templateUrl: './subject-wrapper.component.html',
  styleUrl: './subject-wrapper.component.sass',
  imports: [SubjectComponent],
  host: { ngSkipHydration: 'true' }
})
export class SubjectWrapperComponent {
  isBrowser: boolean;
  constructor(@Inject(PLATFORM_ID) private platformId: any) {
    this.isBrowser = isPlatformBrowser(platformId);
  }
}
