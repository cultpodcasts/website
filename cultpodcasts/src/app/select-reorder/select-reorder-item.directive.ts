import { CdkDrag } from '@angular/cdk/drag-drop';
import { DestroyRef, Directive, ElementRef, inject, OnInit } from '@angular/core';
import { MatOption } from '@angular/material/core';
import { SelectReorderListDirective } from './select-reorder-list.directive';

/**
 * A selected `mat-option` that can be dragged inside its `appSelectReorderList`. Dragging is limited
 * to the y axis and starts only from the option's `app-select-reorder-handle`. The option advertises
 * the keyboard reorder to assistive tech with `aria-keyshortcuts` (the handle itself is aria-hidden).
 */
@Directive({
  selector: 'mat-option[appSelectReorderItem]',
  hostDirectives: [CdkDrag],
  host: {
    class: 'select-reorder-option',
    'aria-keyshortcuts': 'Alt+ArrowUp Alt+ArrowDown'
  }
})
export class SelectReorderItemDirective implements OnInit {
  private readonly drag = inject(CdkDrag, { self: true });
  private readonly option = inject(MatOption, { self: true });
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly list = inject(SelectReorderListDirective);

  constructor() {
    this.drag.lockAxis = 'y';
    // Keep the preview inside the select panel so it keeps the panel's option styles and stacking.
    this.drag.previewContainer = 'parent';
    const started = this.drag.started.subscribe(() => this.list.dragStarted());
    const ended = this.drag.ended.subscribe(() => this.list.dragEnded());
    inject(DestroyRef).onDestroy(() => {
      started.unsubscribe();
      ended.unsubscribe();
      this.list.unregisterItem(this.option);
    });
  }

  ngOnInit(): void {
    this.list.registerItem(this.option, this.element);
  }
}
