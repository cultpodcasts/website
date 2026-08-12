import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Layout shell for /content/* pages. Child routes render privacy/terms into the
 * outlet (no @switch on :path — that raced SSR privacy DOM vs client Not Found).
 * server.ts SSRs these at request time (not prerender); child routes keep
 * AppComponent chrome hydration aligned with the privacy/terms tree.
 */
@Component({
  selector: 'app-content',
  templateUrl: './content.component.html',
  styleUrls: ['./content.component.sass'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
})
export class ContentComponent {}
