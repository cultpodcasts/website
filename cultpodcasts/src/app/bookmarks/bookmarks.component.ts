import { Component } from '@angular/core';
import { BookmarksApiComponent } from "../bookmarks-api/bookmarks-api.component";

@Component({
  selector: 'app-bookmarks',
  imports: [BookmarksApiComponent],
  templateUrl: './bookmarks.component.html',
  styleUrl: './bookmarks.component.sass'
})
export class BookmarksComponent {

}
