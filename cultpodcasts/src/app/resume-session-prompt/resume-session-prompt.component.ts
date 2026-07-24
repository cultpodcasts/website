import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PlayerService } from '../player.service';
import { episodeImageUrl } from '../search-result-links';

@Component({
  selector: 'app-resume-session-prompt',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './resume-session-prompt.component.html',
  styleUrl: './resume-session-prompt.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'alertdialog',
    'aria-label': 'Resume previous listening session',
  },
})
export class ResumeSessionPromptComponent {
  private readonly playerService = inject(PlayerService);

  protected readonly session = this.playerService.pendingResume;
  protected readonly isOpen = computed(() => !!this.session());

  protected readonly nowPlaying = computed(() => this.session()?.nowPlaying);
  protected readonly queuedCount = computed(() => this.session()?.queue.length ?? 0);

  protected readonly artwork = computed(() => {
    const ep = this.nowPlaying();
    return ep ? episodeImageUrl(ep)?.toString() : undefined;
  });

  resume(): void {
    this.playerService.resumeSession();
  }

  dismiss(): void {
    this.playerService.dismissSession();
  }
}
