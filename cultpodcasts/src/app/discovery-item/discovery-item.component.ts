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
  @Input() events: Observable<boolean> | undefined;

  private eventsSubscription!: Subscription;

  submitted: boolean = false;

  ngOnInit() {
    if (this.events) {
      this.eventsSubscription = this.events.subscribe((x) => this.submitted = x);
    }
  }

  ngOnDestroy() {
    this.eventsSubscription.unsubscribe();
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
    this.changeState.emit({ id: this.result.id, selected: selected });
  }

  allowLink($event: Event) {
    $event.stopPropagation();
  }
}
