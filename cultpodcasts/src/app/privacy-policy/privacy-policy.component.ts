import { Component } from '@angular/core';
import { version, buildDate, commitHash } from "src/environments/version";

@Component({
    selector: 'privacy-policy',
    templateUrl: './privacy-policy.component.html',
    styleUrls: ['./privacy-policy.component.sass'],
    standalone: true
})
export class PrivacyPolicyComponent {
  getVersion(): string {
    return `Version ${version}, commit ${commitHash}, built at ${buildDate}`;
  }
}
