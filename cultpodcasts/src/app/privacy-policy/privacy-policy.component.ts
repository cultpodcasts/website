import { Component } from '@angular/core';
import { version, buildDate, commitHash } from "src/environments/version";
import { SeoService } from '../seo.service';
import { Title } from '@angular/platform-browser';

@Component({
  selector: 'privacy-policy',
  templateUrl: './privacy-policy.component.html',
  styleUrls: ['./privacy-policy.component.sass'],
  standalone: true
})
export class PrivacyPolicyComponent {
  constructor(
    title: Title,
    seoService: SeoService) {
    title.setTitle("Privacy Policy");
    seoService.AddMetaTags({ title: "Privacy Policy" });
  }

  getVersion(): string {
    return `Version ${version}, commit ${commitHash}, built at ${buildDate}`;
  }
}
