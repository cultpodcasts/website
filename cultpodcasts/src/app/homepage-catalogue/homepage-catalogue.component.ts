import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SlotMachineCounterComponent } from '../slot-machine-counter/slot-machine-counter.component';

@Component({
  selector: 'app-homepage-catalogue',
  imports: [DecimalPipe, SlotMachineCounterComponent],
  templateUrl: './homepage-catalogue.component.html',
  styleUrl: './homepage-catalogue.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomepageCatalogueComponent {
  readonly weekEpisodeCount = input<number | undefined>();
  readonly episodeCount = input<number | undefined>();
  readonly totalDurationDays = input<string>('');
  readonly episodeCountBaseline = input(80000);
}
