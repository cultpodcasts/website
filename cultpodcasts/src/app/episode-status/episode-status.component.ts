import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { ApiEpisode } from '../api-episode.interface';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FeatureSwitch } from '../feature-switch.enum';
import { FeatureSwtichService } from '../feature-switch-service';

@Component({
  selector: 'app-episode-status',
  imports: [
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './episode-status.component.html',
  styleUrl: './episode-status.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EpisodeStatusComponent {
  protected _episode: ApiEpisode | undefined;
  protected readonly showReddit: boolean;

  @Input()
  editable: boolean = false;

  @Input()
  disabled: boolean = false;

  @Input()
  loadingIgnored: boolean = false;

  @Input()
  loadingRemoved: boolean = false;

  @Input()
  loadingTweeted: boolean = false;

  @Input()
  loadingBluesky: boolean = false;

  @Output()
  toggleIgnored = new EventEmitter<void>();

  @Output()
  toggleRemoved = new EventEmitter<void>();

  @Output()
  toggleTweeted = new EventEmitter<void>();

  @Output()
  toggleBluesky = new EventEmitter<void>();

  constructor(featureSwitchService: FeatureSwtichService) {
    this.showReddit = featureSwitchService.IsEnabled(FeatureSwitch.redditPost);
  }

  @Input({ required: true })
  set episode(e: ApiEpisode) {
    this._episode = e;
  }

  get anyActionBusy(): boolean {
    return this.disabled
      || this.loadingIgnored
      || this.loadingRemoved
      || this.loadingTweeted
      || this.loadingBluesky;
  }

  onToggleIgnored($event: Event) {
    $event.preventDefault();
    $event.stopPropagation();
    this.toggleIgnored.emit();
  }

  onToggleRemoved($event: Event) {
    $event.preventDefault();
    $event.stopPropagation();
    this.toggleRemoved.emit();
  }

  onToggleTweeted($event: Event) {
    $event.preventDefault();
    $event.stopPropagation();
    this.toggleTweeted.emit();
  }

  onToggleBluesky($event: Event) {
    $event.preventDefault();
    $event.stopPropagation();
    this.toggleBluesky.emit();
  }
}
