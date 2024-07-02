import { Component } from '@angular/core';
import { SeoService } from '../seo.service';

@Component({
    selector: 'app-unauthorised',
    templateUrl: './unauthorised.component.html',
    styleUrls: ['./unauthorised.component.sass'],
    standalone: true
})
export class UnauthorisedComponent {
    constructor(private seoService: SeoService) {
        seoService.AddMetaTags({ title: "Unauthorised" });
    }
}
