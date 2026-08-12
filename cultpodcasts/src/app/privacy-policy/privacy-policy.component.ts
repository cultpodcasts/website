import { Component, isDevMode, ChangeDetectionStrategy } from '@angular/core';
import { version, buildDate, commitHash } from "src/environments/version";
import { SeoService } from '../seo.service';
import { Title } from '@angular/platform-browser';
import { environment } from './../../environments/environment';

@Component({
  selector: 'privacy-policy',
  templateUrl: './privacy-policy.component.html',
  styleUrls: ['./privacy-policy.component.sass'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class PrivacyPolicyComponent {

  protected metadata = {
    version: version,
    // Keep the build-time ISO string — Date#toString() differs SSR vs browser TZ.
    buildDate,
    commitHash: commitHash,
    environmentName: environment.name,
    isDevMode: isDevMode()
  }

  constructor(
    title: Title,
    seoService: SeoService) {
    title.setTitle("Privacy Policy");
    seoService.AddMetaTags({ title: "Privacy Policy" });
  }
}
