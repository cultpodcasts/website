import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params } from '@angular/router';
import { combineLatest } from 'rxjs';
import { TermsAndConditionsComponent } from '../terms-and-conditions/terms-and-conditions.component';
import { PrivacyPolicyComponent } from '../privacy-policy/privacy-policy.component';


@Component({
  selector: 'app-content',
  templateUrl: './content.component.html',
  styleUrls: ['./content.component.sass'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PrivacyPolicyComponent, TermsAndConditionsComponent]
})
export class ContentComponent {
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  protected content = signal<string | undefined>(undefined);

  ngOnInit() {
    combineLatest(
      [this.route.params, this.route.queryParams],
      (params: Params, queryParams: Params) => ({
        params,
        queryParams,
      })
    ).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((res: { params: Params; queryParams: Params }) => {
      const { params } = res;
      this.content.set(params["path"] ?? "unknown");
    });
  }
}
