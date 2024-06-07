import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IDiscoveryResult } from '../IDiscoveryResults';
import { Observable, Subscription } from 'rxjs';

@Component({
  selector: 'discovery-item',
  templateUrl: './discovery-item.component.html',
  styleUrls: ['./discovery-item.component.sass']
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

  ngOnInit() {
    if (this.selectedEvent) {
      this.eventsSubscription = this.selectedEvent.subscribe((x) => this.submitted = x);
    }
    if (this.resultFilterEvent) {
      this.resultsFilterSubscription = this.resultFilterEvent.subscribe((x) => this.resultsFilter = x);
    }
    if (this.erroredEvent) {
      this.erroredSubscription = this.erroredEvent.subscribe((x) => x.indexOf(this.result.id));
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
