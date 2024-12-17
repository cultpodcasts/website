import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IDiscoveryResult } from "../IDiscoveryResult";
import { Observable, Subscription } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { HideDirective } from '../hide.directive';
import { NgClass, DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { EpisodeImageComponent } from "../episode-image/episode-image.component";
import { SubjectsComponent } from "../subjects/subjects.component";
import { ApplePodcastsSvgComponent } from "../apple-podcasts-svg/apple-podcasts-svg.component";

@Component({
  selector: 'discovery-item',
  templateUrl: './discovery-item.component.html',
  styleUrls: ['./discovery-item.component.sass'],
  imports: [
    MatCardModule,
    NgClass,
    HideDirective,
    MatButtonModule,
    MatIconModule,
    DatePipe,
    EpisodeImageComponent,
    SubjectsComponent,
    ApplePodcastsSvgComponent
]
})

export class DiscoveryItemComponent {
  @Input() result!: IDiscoveryResult;
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

  duration(): string {
    if (this.result.duration) {
      return "[" + this.result.duration.split(".")[0].substring(1) + "]";
    }
    return "Unknown";
  }

  ngOnInit() {
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

  handleResult($event: Event, result: IDiscoveryResult) {
    if (this.submitted)
      return;
    const selectedClass: string = "selected";
    let element: Element = $event.target as Element;
    var isButton = false;
    isButton = element.getAttribute("mat-icon-button") != null;
    while (!isButton && element.nodeName.toLowerCase() != "mat-card") {
      element = element.parentElement!;
      isButton = isButton || element.getAttribute("mat-icon-button") != null;
    }
    let selected = false;
    if (!isButton) {
      if (element.className.split(" ").includes(selectedClass)) {
        element.className = element.className.split(" ").filter(x => x != selectedClass).join(" ");
      } else {
        selected = true;
        element.className = element.className.split(" ").concat(selectedClass).join(" ");
      }
    }
    this.selected = selected;
    this.changeState.emit({ id: this.result.id, selected: selected });
  }

  allowLink($event: Event) {
    $event.stopPropagation();
  }
}
