import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BookmarksApiComponent } from "../bookmarks-api/bookmarks-api.component";

@Component({
  selector: 'app-bookmarks',
  imports: [BookmarksApiComponent],
  templateUrl: './bookmarks.component.html',
  styleUrl: './bookmarks.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BookmarksComponent {

}
