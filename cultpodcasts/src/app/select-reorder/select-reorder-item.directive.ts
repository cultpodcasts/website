import { CdkDrag } from '@angular/cdk/drag-drop';
import { DestroyRef, Directive, inject, OnInit } from '@angular/core';
import { MatOption } from '@angular/material/core';
import { SelectReorderListDirective } from './select-reorder-list.directive';

/**
 * A selected `mat-option` that can be dragged inside its `appSelectReorderList`. Dragging is limited
 * to the y axis and starts only from the option's `app-select-reorder-handle`.
 */
@Directive({
  selector: 'mat-option[appSelectReorderItem]',
  hostDirectives: [CdkDrag],
  host: { class: 'select-reorder-option' }
})
export class SelectReorderItemDirective implements OnInit {
  private readonly drag = inject(CdkDrag, { self: true });
  private readonly option = inject(MatOption, { self: true });
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
    this.drag.data = this.option.value;
    this.list.registerItem(this.option);
  }
}
