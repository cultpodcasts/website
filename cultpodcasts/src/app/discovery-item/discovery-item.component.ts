import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { DiscoveryResult } from "../discovery-result.interface";
import { Observable, Subscription } from 'rxjs';
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
  ]
})

export class DiscoveryItemComponent implements OnChanges {
  @Input() result!: DiscoveryResult;
  @Input() selectedIds: string[] = [];
  @Output() changeState = new EventEmitter<{ id: string, selected: boolean }>();
  @Input() selectedEvent: Observable<boolean> | undefined;
  @Input() resultFilterEvent: Observable<string> | undefined;
  @Input() erroredEvent: Observable<string[]> | undefined;

  private eventsSubscription!: Subscription;
  private resultsFilterSubscription!: Subscription;
  private erroredSubscription!: Subscription;

  selected: boolean = false;
  submitted: boolean = false;
  resultsFilter: string = "";
  errored: boolean = false;
  scoreDisplay: DiscoveryScoreDisplay = { label: 'Unscored', tier: 'unscored', percent: null };

  constructor(
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) { }

  duration(): { known: boolean, text: string } {
    if (this.result.duration) {
      let duration: string = this.result.duration.split(".")[0];
      if (duration.startsWith("0")) {
        duration = duration.substring(1);
      }
      return { known: true, text: duration };
    }
    return { known: false, text: "Unknown" };
  }

  matchingPodcastNames(): string {
    return this.result.matchingPodcasts?.map((podcast) => `${podcast.name} (Visible=${podcast.visible}, Episodes=${podcast.visibleEpisodes})`).join(", ") ?? "";
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['result']) {
      this.scoreDisplay = this.buildScoreDisplay(this.result.acceptProbability);
    }
    if (changes['selectedIds']) {
      this.selected = this.selectedIds.includes(this.result.id);
    }
  }

  ngOnInit() {
    this.scoreDisplay = this.buildScoreDisplay(this.result.acceptProbability);
    this.selected = this.selectedIds.includes(this.result.id);
    if (this.selectedEvent) {
      this.eventsSubscription = this.selectedEvent.subscribe((x) => this.submitted = x);
    }
    if (this.resultFilterEvent) {
      this.resultsFilterSubscription = this.resultFilterEvent.subscribe((x) => this.resultsFilter = x);
    }
    if (this.erroredEvent) {
      this.erroredSubscription = this.erroredEvent.subscribe((x) => this.errored = x.indexOf(this.result.id) >= 0);
    }
  }

  ngOnDestroy() {
    if (this.selectedEvent) {
      this.eventsSubscription.unsubscribe();
    }
    if (this.resultFilterEvent) {
      this.resultsFilterSubscription.unsubscribe();
    }
    if (this.erroredEvent) {
      this.erroredSubscription.unsubscribe();
    }
  }

  handleResult($event: Event, result: DiscoveryResult) {
    if (this.submitted)
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
    let selected = false;
    if (!isButton && !this.selected) {
      selected = true;
    }
    this.selected = selected;
    this.changeState.emit({ id: this.result.id, selected: selected });
  }

  allowLink($event: Event) {
    $event.stopPropagation();
  }

  editPodcast($event: Event) {
    $event.stopPropagation();
    const podcastName = this.result.matchingPodcasts?.[0]?.name;
    if (!podcastName) {
      return;
    }

    const dialogRef = this.dialog.open(EditPodcastDialogComponent, {
      data: { podcastName, episodeId: undefined },
      disableClose: true,
      autoFocus: true,
      width: '90%'
    });
    dialogRef.afterClosed().subscribe(result => {
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
