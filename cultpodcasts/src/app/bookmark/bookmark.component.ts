import { Component, HostBinding, input, InputSignal } from '@angular/core';
import { ProfileService } from '../profile.service';
import { MatIconModule } from '@angular/material/icon';
import { ReplaySubject, timer } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { AsyncPipe } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-bookmark',
  imports: [
    MatIconModule,
    MatButtonModule,
    AsyncPipe,
    MatProgressSpinnerModule
  ],
  templateUrl: './bookmark.component.html',
  styleUrl: './bookmark.component.sass'
})
export class BookmarkComponent {
  episodeId = input.required<string>();
  hasMenu: InputSignal<boolean> = input<boolean>(false);
  isBookmarked$: ReplaySubject<boolean> = new ReplaySubject<boolean>(1);
  isAuthenticated$: ReplaySubject<boolean> = new ReplaySubject<boolean>(1);
  waitingCallback: boolean = true;
  private isBookmarked: boolean | undefined;
  protected showBookmark: boolean = true;

  @HostBinding('class.has-menu')
  get hasMenuGet() { return this.hasMenu() }

  constructor(
    private profileService: ProfileService
  ) { }

  ngOnInit() {
    this.profileService.isAuthenticated$.subscribe(isAuthenticated =>
      this.isAuthenticated$.next(isAuthenticated)
    );
    this.profileService.bookmarks$.subscribe(bookmarks => {
      const state: boolean = bookmarks.has(this.episodeId());
      if (this.waitingCallback && state != this.isBookmarked) {
        this.waitingCallback = false;
      }
      this.isBookmarked$.next(state)
      this.isBookmarked = state;
    });
    timer(10000).subscribe(() => {
      if (this.waitingCallback) {
        this.waitingCallback = false;
        this.showBookmark= false;
      }
    });
  }

  async bookmark(): Promise<any> {
    var bookmarked = this.profileService.bookmarks.has(this.episodeId());
    this.waitingCallback = true;
    if (bookmarked) {
      await this.profileService.removeBookmark(this.episodeId());
    } else {
      await this.profileService.addBookmark(this.episodeId());
    }
  }
}
