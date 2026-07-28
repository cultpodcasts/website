import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Content-shaped placeholder for search / podcast / subject / bookmarks grids. */
@Component({
  selector: 'app-browse-loading-skeleton',
  templateUrl: './browse-loading-skeleton.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrowseLoadingSkeletonComponent {
  protected readonly posters = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  protected readonly pills = [1, 2, 3, 4, 5, 6];
}
