import { Component, Input } from '@angular/core';
import { ProfileService } from '../profile.service';
import { MatIconModule } from '@angular/material/icon';
import { BehaviorSubject, Observable } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-bookmark',
  imports: [
    MatIconModule,
    MatButtonModule
  ],
  templateUrl: './bookmark.component.html',
  styleUrl: './bookmark.component.sass'
})
export class BookmarkComponent {
  @Input()
  episodeId: string | undefined;
  isBookmarked: boolean = false;
  isAuthenticated$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  constructor(
    private profileService: ProfileService
  ) { }

  ngOnInit() {
    this.profileService.isAuthenticated$.subscribe(isAuthenticated => this.isAuthenticated$.next(isAuthenticated));
    this.isBookmarked = this.bookmarksHasEpisodeId(this.episodeId!);
  }

  protected bookmarksHasEpisodeId(episodeId: string): boolean {
    return this.profileService.bookmarks.has(episodeId);
  }
}
