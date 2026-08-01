import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-hero-promote-button',
  imports: [MatIconModule],
  templateUrl: './hero-promote-button.component.html',
  styleUrl: './hero-promote-button.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroPromoteButtonComponent {
  readonly promoted = input(false);
  readonly promoteToggle = output<MouseEvent>();

  onClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.promoteToggle.emit(event);
  }
}
