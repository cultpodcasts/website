import { Component } from '@angular/core';
import { version, buildDate, commitHash } from "src/environments/version";
import { SeoService } from '../seo.service';

@Component({
  selector: 'privacy-policy',
  templateUrl: './privacy-policy.component.html',
  styleUrls: ['./privacy-policy.component.sass'],
  standalone: true
})
export class PrivacyPolicyComponent {
  constructor(private seoService: SeoService) {
    seoService.AddMetaTags({ title: "Privacy Policy" });
  }

  getVersion(): string {
    return `Version ${version}, commit ${commitHash}, built at ${buildDate}`;
  }
}
