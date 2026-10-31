import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * The right-hand drag handle on a reorderable selected `mat-option`. It is the only place a drag
 * can start (so touch scrolling still works on the rest of the panel). A click or tap on it never
 * toggles the option. It has no text, so the option's `viewValue` (and the select trigger text)
 * is unchanged. Hidden from assistive tech: keyboard users reorder with Alt+ArrowUp/Down.
 */
@Component({
  selector: 'app-select-reorder-handle',
  hostDirectives: [CdkDragHandle],
  templateUrl: './select-reorder-handle.component.html',
  styleUrl: './select-reorder-handle.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'select-reorder-handle',
    'aria-hidden': 'true',
    title: 'Drag to reorder (Alt+Up / Alt+Down)',
    '(click)': 'swallow($event)',
    '(pointerdown)': 'stopPointer($event)'
  }
})
export class SelectReorderHandleComponent {
  /** A click or tap on the handle must not reach the option (which would toggle it). */
  protected swallow(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
  }

  /**
   * Keep pointerdown off the option. The CDK drag listens to mousedown / touchstart on the option,
   * so stopping pointerdown does not stop the drag.
   */
  protected stopPointer(event: Event): void {
    event.stopPropagation();
  }
}
