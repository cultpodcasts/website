import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/**
 * Layout shell for /content/* pages. Child routes render privacy/terms into the
 * outlet (no @switch on :path — that raced SSR privacy DOM vs client Not Found).
 * Privacy/terms are prerendered (SSG) and excluded from the Pages Worker so the
 * baked HTML hydrates; other /content/* may still SSR via server.ts.
 */
@Component({
  selector: 'app-content',
  templateUrl: './content.component.html',
  styleUrls: ['./content.component.sass'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
})
export class ContentComponent {}
