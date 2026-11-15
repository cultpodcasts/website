import { Component, ChangeDetectionStrategy } from '@angular/core';
import { SeoService } from '../seo.service';
import { Title } from '@angular/platform-browser';

@Component({
    selector: 'legal-notices',
    templateUrl: './legal-notices.component.html',
    styleUrls: ['./legal-notices.component.sass'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true
})
export class LegalNoticesComponent {
    constructor(
        title: Title,
        seoService: SeoService) {
        title.setTitle("Legal Notices");
        seoService.AddMetaTags({ title: "Legal Notices" });
    }
}
