import { Component } from '@angular/core';
import { SeoService } from '../seo.service';
import { Title } from '@angular/platform-browser';

@Component({
    selector: 'terms-and-conditions',
    templateUrl: './terms-and-conditions.component.html',
    styleUrls: ['./terms-and-conditions.component.sass'],
    standalone: true
})
export class TermsAndConditionsComponent {
    constructor(private title: Title,
        private seoService: SeoService) {
        title.setTitle("Terms & Conditions");
        seoService.AddMetaTags({ title: "Terms &amp; Conditions" });
    }
}
