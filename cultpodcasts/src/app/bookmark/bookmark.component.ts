import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  Signal,
  computed,
  inject,
  input,
  signal
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ProfileService } from '../profile.service';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-bookmark',
  imports: [
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './bookmark.component.html',
  styleUrl: './bookmark.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BookmarkComponent {
  episodeId = input.required<string>();
  hasMenu = input<boolean>(false);
  protected readonly waitingCallback = signal(true);
  protected readonly bookmarkTimeout: Signal<boolean> = timerSignal(5000);
  protected readonly isAuthenticated = toSignal(
    inject(ProfileService).isAuthenticated$,
    { initialValue: false }
  );
  private readonly profileService = inject(ProfileService);
  private readonly bookmarks = toSignal(
    this.profileService.bookmarks$,
    { initialValue: new Set<string>() }
  );
  private readonly isBookmarkedState = signal<boolean | undefined>(undefined);
  protected readonly isBookmarked = computed(() =>
    this.bookmarks().has(this.episodeId())
  );

  @HostBinding('class.has-menu')
  get hasMenuGet() { return this.hasMenu(); }

  constructor() {
    this.profileService.bookmarks$
      .pipe(takeUntilDestroyed())
      .subscribe(bookmarks => {
        const state = bookmarks.has(this.episodeId());
        if (this.waitingCallback() && state !== this.isBookmarkedState()) {
          this.waitingCallback.set(false);
        }
        this.isBookmarkedState.set(state);
      });
  }

  async bookmark(): Promise<void> {
    const bookmarked = this.profileService.bookmarks.has(this.episodeId());
    this.waitingCallback.set(true);
    if (bookmarked) {
      await this.profileService.removeBookmark(this.episodeId());
    } else {
      await this.profileService.addBookmark(this.episodeId());
    }
  }
}

function timerSignal(ms: number): Signal<boolean> {
  const done = signal(false);
  setTimeout(() => done.set(true), ms);
  return done.asReadonly();
}
