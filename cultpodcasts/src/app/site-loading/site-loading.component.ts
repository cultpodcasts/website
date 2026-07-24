import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-site-loading',
  templateUrl: './site-loading.component.html',
  styleUrl: './site-loading.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteLoadingComponent {
  /** Show the global loading indicator. */
  readonly active = input(false);
  /** Accessible status label. */
  readonly label = input('Updating');
}
