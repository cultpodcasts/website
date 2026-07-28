import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Content-shaped placeholder for the episode detail hero + rails. */
@Component({
  selector: 'app-episode-loading-skeleton',
  templateUrl: './episode-loading-skeleton.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Avoid hydrating skeleton DOM against SSR loading shells.
  host: { ngSkipHydration: 'true' },
})
export class EpisodeLoadingSkeletonComponent {
  protected readonly posters = [1, 2, 3, 4, 5, 6];
}
