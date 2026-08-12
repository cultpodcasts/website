import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { SeoService } from '../seo.service';

@Component({
  selector: 'app-content-not-found',
  template: `<h1>Not Found!</h1>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class ContentNotFoundComponent {
  constructor(title: Title, seoService: SeoService) {
    title.setTitle('Not Found');
    seoService.AddMetaTags({ title: 'Not Found' });
  }
}
