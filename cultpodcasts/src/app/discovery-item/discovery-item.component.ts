import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  computed,
  effect,
  inject,
  input,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DiscoveryResult } from "../discovery-result.interface";
import { Observable } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { HideDirective } from '../hide.directive';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { EpisodeImageComponent } from "../episode-image/episode-image.component";
import { SubjectsComponent } from "../subjects/subjects.component";
import { ApplePodcastsSvgComponent } from "../apple-podcasts-svg/apple-podcasts-svg.component";
import { RouterLink } from '@angular/router';
import { ClampableTextComponent } from '../clampable-text/clampable-text.component';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EditPodcastDialogComponent } from '../edit-podcast-dialog/edit-podcast-dialog.component';

export interface DiscoveryScoreDisplay {
  label: string;
  tier: 'likely' | 'review' | 'unlikely' | 'unscored';
  percent: string | null;
}

@Component({
  selector: 'discovery-item',
  templateUrl: './discovery-item.component.html',
  styleUrls: ['./discovery-item.component.sass'],
  imports: [
    RouterLink,
    MatCardModule,
    HideDirective,
    MatButtonModule,
    MatIconModule,
    DatePipe,
    EpisodeImageComponent,
    SubjectsComponent,
    ApplePodcastsSvgComponent,
    ClampableTextComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class DiscoveryItemComponent implements OnInit {
  result = input.required<DiscoveryResult>();
  selectedIds = input<string[]>([]);
  @Output() changeState = new EventEmitter<{ id: string, selected: boolean }>();
  @Input() selectedEvent: Observable<boolean> | undefined;
  @Input() resultFilterEvent: Observable<string> | undefined;
  @Input() erroredEvent: Observable<string[]> | undefined;

  protected readonly selected = signal(false);
  protected readonly submitted = signal(false);
  protected readonly resultsFilter = signal("");
  protected readonly errored = signal(false);
  protected readonly scoreDisplay = computed(() =>
    this.buildScoreDisplay(this.result().acceptProbability)
  );

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    effect(() => {
      this.selected.set(this.selectedIds().includes(this.result().id));
    });
  }

  duration(): { known: boolean, text: string } {
    const result = this.result();
    if (result.duration) {
      let duration: string = result.duration.split(".")[0];
      if (duration.startsWith("0")) {
        duration = duration.substring(1);
      }
      return { known: true, text: duration };
    }
    return { known: false, text: "Unknown" };
  }

  matchingPodcastNames(): string {
    return this.result().matchingPodcasts?.map((podcast) => `${podcast.name} (Visible=${podcast.visible}, Episodes=${podcast.visibleEpisodes})`).join(", ") ?? "";
  }

  ngOnInit() {
    if (this.selectedEvent) {
      this.selectedEvent
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(x => this.submitted.set(x));
    }
    if (this.resultFilterEvent) {
      this.resultFilterEvent
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(x => this.resultsFilter.set(x));
    }
    if (this.erroredEvent) {
      this.erroredEvent
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(x => this.errored.set(x.indexOf(this.result().id) >= 0));
    }
  }

  handleResult($event: Event, result: DiscoveryResult) {
    if (this.submitted())
      return;
    let element: Element = $event.target as Element;
    var isButton = false;
    isButton = element.nodeName.toLowerCase() === 'button' || element.getAttribute("mat-icon-button") != null;
    while (!isButton && element.nodeName.toLowerCase() != "mat-card") {
      element = element.parentElement!;
      isButton = isButton
        || element.nodeName.toLowerCase() === 'button'
        || element.getAttribute("mat-icon-button") != null;
    }
    let nextSelected = false;
    if (!isButton && !this.selected()) {
      nextSelected = true;
    }
    this.selected.set(nextSelected);
    this.changeState.emit({ id: this.result().id, selected: nextSelected });
  }

  allowLink($event: Event) {
    $event.stopPropagation();
  }

  editPodcast($event: Event) {
    $event.stopPropagation();
    const podcastName = this.result().matchingPodcasts?.[0]?.name;
    if (!podcastName) {
      return;
    }

    const dialogRef = this.dialog.open(EditPodcastDialogComponent, {
      data: { podcastName, episodeId: undefined },
      disableClose: true,
      autoFocus: true,
      width: '90%'
    });
    dialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        if (result?.updated) {
          let message = 'Podcast updated';
          if (result.response?.failureIndexingEpisodes) {
            message += '. Some episodes failed to index';
          }
          this.snackBar.open(message, 'Ok', { duration: 10000 });
        } else if (result?.noChange) {
          this.snackBar.open('No change', 'Ok', { duration: 3000 });
        }
      });
  }

  private buildScoreDisplay(acceptProbability: number | null | undefined): DiscoveryScoreDisplay {
    if (acceptProbability == null) {
      return { label: 'Unscored', tier: 'unscored', percent: null };
    }
    const percent = `${Math.round(acceptProbability * 100)}%`;
    if (acceptProbability >= 0.5) {
      return { label: 'Likely match', tier: 'likely', percent };
    }
    if (acceptProbability < 0.05) {
      return { label: 'Unlikely', tier: 'unlikely', percent };
    }
    return { label: 'Review', tier: 'review', percent };
  }
}
