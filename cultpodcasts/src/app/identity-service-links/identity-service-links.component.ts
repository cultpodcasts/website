import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { IdentityServiceLink } from '../identity-service-links';

/** Small external-link chips for IMDb / TMDB / TVDB on public film, TV-show and TV-episode pages. */
@Component({
  selector: 'app-identity-service-links',
  imports: [MatIconModule],
  templateUrl: './identity-service-links.component.html',
  styleUrl: './identity-service-links.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.identity-links--page]': 'tone() === "page"' }
})
export class IdentityServiceLinksComponent {
  readonly links = input.required<readonly IdentityServiceLink[]>();
  /** `hero` is on the film/episode billboard (light on dark); `page` is on the TV-show hub (dark on light). */
  readonly tone = input<'hero' | 'page'>('hero');
}
