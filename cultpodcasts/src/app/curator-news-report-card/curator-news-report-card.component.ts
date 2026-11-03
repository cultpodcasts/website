import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Router, RouterLink } from '@angular/router';
import { ApiEpisode } from '../api-episode.interface';
import { reviewPlayableLink } from '../catalogue-links';
import { CuratorPlayableCardBodyComponent } from '../curator-playable-card-body/curator-playable-card-body.component';
import { curatorCardDuration, curatorCardLanguageBadge } from '../curator-playable-card-meta';
import { EpisodeImageComponent } from '../episode-image/episode-image.component';
import { HeroPromoteButtonComponent } from '../hero-promote-button/hero-promote-button.component';
import { ViewerLocaleService } from '../viewer-locale';

@Component({
  selector: 'app-curator-news-report-card',
  imports: [
    MatCardModule,
    MatButtonModule,
    MatMenuModule,
    MatIconModule,
    RouterLink,
    DatePipe,
    EpisodeImageComponent,
    HeroPromoteButtonComponent,
    CuratorPlayableCardBodyComponent,
  ],
  templateUrl: './curator-news-report-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CuratorNewsReportCardComponent {
  private readonly router = inject(Router);
  private readonly locale = inject(ViewerLocaleService).locale;

  readonly episode = input.required<ApiEpisode>();
  readonly showPromote = input(false);
  readonly promoted = input(false);
  readonly titleAsLink = input(true);
  readonly updating = input(false);
  readonly loadingSubjectName = input<string | null>(null);
  readonly loadingGuestName = input<string | null>(null);
  readonly loadingIgnored = input(false);
  readonly loadingRemoved = input(false);
  readonly loadingTweeted = input(false);
  readonly loadingBluesky = input(false);
  readonly statusActionLoading = input(false);

  readonly edit = output<ApiEpisode>();
  readonly post = output<ApiEpisode>();
  readonly promoteToggle = output<ApiEpisode>();
  readonly removeSubject = output<{ episode: ApiEpisode; subject: string }>();
  readonly removeGuest = output<{ episode: ApiEpisode; guestName: string }>();
  readonly addSuggestedGuest = output<{ episode: ApiEpisode; name: string }>();
  readonly toggleIgnored = output<ApiEpisode>();
  readonly toggleRemoved = output<ApiEpisode>();
  readonly toggleTweeted = output<ApiEpisode>();
  readonly toggleBluesky = output<ApiEpisode>();

  protected readonly duration = computed(() => curatorCardDuration(this.episode().duration));
  protected readonly languageBadge = computed(() =>
    curatorCardLanguageBadge(this.episode(), this.locale())
  );
  protected readonly titleLink = computed(() => {
    const link = reviewPlayableLink(this.episode());
    return typeof link === 'string' ? this.router.parseUrl(link) : link;
  });
  protected readonly parentName = computed(
    () => this.episode().parentName ?? this.episode().podcastName ?? ''
  );
}
