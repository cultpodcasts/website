import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import {
  afterNextRender,
  DestroyRef,
  Directive,
  ElementRef,
  inject,
  Injector,
  output,
  PLATFORM_ID
} from '@angular/core';
import { MatOption } from '@angular/material/core';
import { MatSelect } from '@angular/material/select';
import { moveSelectedValue, reorderAnnouncement, reorderEdgeAnnouncement } from './select-reorder.util';

/** How long after a drag ends a stray click inside the list is swallowed (mouseup → click). */
const CLICK_SUPPRESS_MS = 400;

/**
 * Makes the selected options of a multi `mat-select` reorderable inside the open panel.
 *
 * Wrap the selected (hoisted) `mat-option`s in an element with this directive, mark each one
 * `appSelectReorderItem`, and give each a right-hand `app-select-reorder-handle`:
 *
 * ```html
 * <div appSelectReorderList (reordered)="regroupSubjects()">
 *   @for (subject of selectedSubjects(); track subject) {
 *   <mat-option appSelectReorderItem [value]="subject">{{subject}}<app-select-reorder-handle /></mat-option>
 *   }
 * </div>
 * ```
 *
 * - Drag: a `CdkDropList` (host directive, y axis only). Dragging starts from the handle only, so touch
 *   scrolling of the panel still works everywhere else. On drop the select's form control value is
 *   reordered with `moveItemInArray` and set; `reordered` fires so the host can regroup.
 * - Keyboard: while the panel is open and the active option is a selected (reorderable) one, Alt+ArrowUp
 *   and Alt+ArrowDown move it one place. mat-select itself closes the panel on Alt+Arrow, so this
 *   listens in the capture phase on the select's host element and stops the event when it handles it.
 *   Alt+Arrow on an option that is not selected keeps mat-select's behaviour (close).
 * - Each move is announced through the CDK `LiveAnnouncer` (aria-live polite).
 */
@Directive({
  selector: '[appSelectReorderList]',
  hostDirectives: [CdkDropList],
  host: { class: 'select-reorder-list' }
})
export class SelectReorderListDirective {
  /** The new control value after a drag or keyboard move. */
  readonly reordered = output<string[]>();

  private readonly select = inject(MatSelect);
  private readonly dropList = inject(CdkDropList, { self: true });
  private readonly announcer = inject(LiveAnnouncer);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly document = inject(DOCUMENT);
  private readonly items = new Set<MatOption>();
  private dragging = false;
  private suppressClicksUntil = 0;

  constructor() {
    this.dropList.lockAxis = 'y';
    this.dropList.orientation = 'vertical';
    const dropped = this.dropList.dropped.subscribe(event => this.onDrop(event));
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => dropped.unsubscribe());

    if (!isPlatformBrowser(inject(PLATFORM_ID))) {
      return;
    }
    const selectHost: HTMLElement = this.select._elementRef.nativeElement;
    const keydown = (event: KeyboardEvent) => this.onSelectKeydown(event);
    const click = (event: MouseEvent) => this.onListClickCapture(event);
    selectHost.addEventListener('keydown', keydown, true);
    this.host.addEventListener('click', click, true);
    destroyRef.onDestroy(() => {
      selectHost.removeEventListener('keydown', keydown, true);
      this.host.removeEventListener('click', click, true);
    });
  }

  /** @internal Called by `appSelectReorderItem`. */
  registerItem(option: MatOption): void {
    this.items.add(option);
  }

  /** @internal Called by `appSelectReorderItem`. */
  unregisterItem(option: MatOption): void {
    this.items.delete(option);
  }

  /** @internal Called by `appSelectReorderItem` when a drag starts. */
  dragStarted(): void {
    this.dragging = true;
  }

  /** @internal Called by `appSelectReorderItem` when a drag ends (dropped or cancelled). */
  dragEnded(): void {
    this.dragging = false;
    this.suppressClicksUntil = this.now() + CLICK_SUPPRESS_MS;
  }

  /** The reorderable (selected) options' values, in the order they are shown. */
  visibleValues(): string[] {
    return this.reorderableOptions().map(option => option.value as string);
  }

  /** Move the shown option at `from` to `to`. Returns true when the value changed. */
  move(from: number, to: number): boolean {
    const control = this.select.ngControl?.control;
    if (!control) {
      return false;
    }
    const options = this.reorderableOptions();
    const visible = options.map(option => option.value as string);
    const next = moveSelectedValue(control.value as string[] | null, visible, from, to);
    if (!next) {
      return false;
    }
    control.setValue(next);
    control.markAsDirty();
    this.reordered.emit(next);
    void this.announcer.announce(reorderAnnouncement(options[from].viewValue, to + 1, visible.length), 'polite');
    return true;
  }

  private reorderableOptions(): MatOption[] {
    return (this.select.options?.toArray() ?? []).filter(option => this.items.has(option));
  }

  private onDrop(event: CdkDragDrop<unknown>): void {
    if (event.previousContainer !== event.container) {
      return;
    }
    this.move(event.previousIndex, event.currentIndex);
  }

  private onSelectKeydown(event: KeyboardEvent): void {
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    const step = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
    if (step === 0 || !this.select.panelOpen) {
      return;
    }
    const active = this.select._keyManager?.activeItem;
    if (!active || !active.selected || !this.items.has(active)) {
      return;
    }
    // Handled here: stop mat-select's Alt+Arrow close and the host's typing filter.
    event.preventDefault();
    event.stopImmediatePropagation();

    const options = this.reorderableOptions();
    const from = options.indexOf(active);
    const to = from + step;
    if (from < 0) {
      return;
    }
    if (to < 0 || to >= options.length) {
      void this.announcer.announce(reorderEdgeAnnouncement(active.viewValue, to < 0 ? 'first' : 'last'), 'polite');
      return;
    }
    if (this.move(from, to)) {
      afterNextRender({
        write: () => {
          const manager = this.select._keyManager;
          if (manager && manager.activeItem !== active) {
            manager.setActiveItem(active);
          }
          active._getHostElement().scrollIntoView?.({ block: 'nearest' });
        }
      }, { injector: this.injector });
    }
  }

  private onListClickCapture(event: MouseEvent): void {
    if (this.dragging || this.now() < this.suppressClicksUntil) {
      // The mouseup that ends a drag must not toggle the option under the pointer.
      event.preventDefault();
      event.stopPropagation();
    }
  }

  private now(): number {
    return this.document.defaultView?.performance?.now() ?? Date.now();
  }
}
