import { Component, Input, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';
import { combineLatest } from 'rxjs';
import { TermsAndConditionsComponent } from '../terms-and-conditions/terms-and-conditions.component';
import { PrivacyPolicyComponent } from '../privacy-policy/privacy-policy.component';
import { NgSwitch, NgSwitchCase, NgSwitchDefault } from '@angular/common';

@Component({
    selector: 'app-content',
    templateUrl: './content.component.html',
    styleUrls: ['./content.component.sass'],
    standalone: true,
    imports: [NgSwitch, NgSwitchCase, PrivacyPolicyComponent, TermsAndConditionsComponent, NgSwitchDefault]
})
export class ContentComponent implements OnInit {
  private route = inject(ActivatedRoute);
  public content: string|undefined;
  ngOnInit() {
    combineLatest(
      this.route.params,
      this.route.queryParams,
      (params: Params, queryParams: Params) => ({
        params,
        queryParams,
      })
    ).subscribe((res: { params: Params; queryParams: Params }) => {
      const { params, queryParams } = res;
      this.content= params["path"] ?? "unknown";
    });
  }
}
