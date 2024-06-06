import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IDiscoveryResult } from '../IDiscoveryResults';

@Component({
  selector: 'discovery-item',
  templateUrl: './discovery-item.component.html',
  styleUrls: ['./discovery-item.component.sass']
})

export class DiscoveryItemComponent {
  @Input() result!: IDiscoveryResult; 
  @Output() changeState = new EventEmitter<{id: string, selected: boolean}>();

  handleResult($event: Event, result: IDiscoveryResult) {
    // if (this.submitted)
    //   return;
    const selectedClass: string = "selected";
    let element: Element = $event.target as Element;
    var isButton = false;
    isButton = element.getAttribute("mat-icon-button") != null;
    while (!isButton && element.nodeName.toLowerCase() != "mat-card") {
      element = element.parentElement!;
      isButton = isButton || element.getAttribute("mat-icon-button") != null;
    }
    let selected= false;
    if (!isButton) {
      if (element.className.split(" ").includes(selectedClass)) {
        element.className = element.className.split(" ").filter(x => x != selectedClass).join(" ");
      } else {
        selected= true;
        element.className = element.className.split(" ").concat(selectedClass).join(" ");
      }
    }
    this.changeState.emit({id: this.result.id, selected: selected });
    // const itemsSelected = this.resultsContainer!.nativeElement.querySelectorAll("mat-card.selected").length;
    // this.closeDisabled = itemsSelected > 0;
    // this.saveDisabled = itemsSelected === 0;
  }

  allowLink($event: Event) {
    $event.stopPropagation();
  }
}
