import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ApiEpisode } from '../api-episode.interface';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-episode-status',
  imports: [
    MatIconModule,
    MatButtonModule
  ],
  templateUrl: './episode-status.component.html',
  styleUrl: './episode-status.component.sass'
})
export class EpisodeStatusComponent {
  protected _episode: ApiEpisode | undefined;

  @Input()
  editable: boolean = false;

  @Input()
  disabled: boolean = false;

  @Output()
  toggleIgnored = new EventEmitter<void>();

  @Output()
  toggleRemoved = new EventEmitter<void>();

  @Input({ required: true })
  set episode(e: ApiEpisode) {
    this._episode = e;
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
}
