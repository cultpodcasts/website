import { Component } from '@angular/core';
import { SeoService } from '../seo.service';

@Component({
    selector: 'terms-and-conditions',
    templateUrl: './terms-and-conditions.component.html',
    styleUrls: ['./terms-and-conditions.component.sass'],
    standalone: true
})
export class TermsAndConditionsComponent {
    constructor(private seoService: SeoService) {
        seoService.AddMetaTags({ title: "Terms &amp; Conditions" });
    }
}
