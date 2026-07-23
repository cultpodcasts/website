import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { BookmarkApiComponent } from '../bookmark-api/bookmark-api.component';

@Component({
  selector: 'app-bookmark',
  imports: [BookmarkApiComponent],
  templateUrl: './bookmark.component.html',
  styleUrl: './bookmark.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BookmarkComponent {
  episodeId = input.required<string>();
  hasMenu = input<boolean>(false);
}
