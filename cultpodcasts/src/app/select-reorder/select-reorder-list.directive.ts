import { isPlatformBrowser } from '@angular/common';
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
import { SelectReorderDirective, SelectReorderKeyHandler } from './select-reorder.directive';
import { moveSelectedValue, reorderAnnouncement, reorderEdgeAnnouncement } from './select-reorder.util';

/**
 * Makes the selected options of a multi `mat-select` reorderable inside the open panel.
 *
 * Mark the `mat-select` with `appSelectReorder`, wrap the selected (hoisted) `mat-option`s in an element
 * with this directive, mark each one `appSelectReorderItem`, and give each a right-hand
 * `app-select-reorder-handle`:
 *
 * ```html
 * <mat-select appSelectReorder [formControl]="subjects" multiple ...>
 *   <div appSelectReorderList (reordered)="regroupSubjects()">
 *     @for (subject of selectedSubjects(); track subject) {
 *     <mat-option appSelectReorderItem [value]="subject">{{subject}}<app-select-reorder-handle /></mat-option>
 *     }
 *   </div>
 *   ...
 * </mat-select>
 * ```
 *
 * - Drag: a `CdkDropList` (host directive, y axis only). Dragging starts from the handle only, so touch
 *   scrolling of the panel still works everywhere else. On drop the select's form control value is
 *   reordered (only the shown values' slots move) and set; `reordered` fires so the host can regroup.
 *   Known limit: the drag does not auto-scroll the select panel (cultpodcasts/website#585).
 * - Keyboard: while the panel is open and the active option is a selected (reorderable) one, Alt+ArrowUp
 *   and Alt+ArrowDown move it one place. The keys arrive through `mat-select[appSelectReorder]`, which
 *   listens in the capture phase ahead of mat-select's own Alt+Arrow close (see that directive).
 *   Alt+Arrow on an option that is not selected keeps mat-select's behaviour (close).
 * - Each move is announced through the CDK `LiveAnnouncer` (aria-live polite).
 */
@Directive({
  selector: '[appSelectReorderList]',
  hostDirectives: [CdkDropList],
  host: { class: 'select-reorder-list' }
})
export class SelectReorderListDirective implements SelectReorderKeyHandler {
  /** The new control value after a drag or keyboard move. */
  readonly reordered = output<string[]>();

  private readonly reorder = inject(SelectReorderDirective);
  private readonly select = this.reorder.select;
  private readonly dropList = inject(CdkDropList, { self: true });
  private readonly announcer = inject(LiveAnnouncer);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly items = new Map<MatOption, HTMLElement>();
  private dragging = false;
  private suppressNextClick = false;
  private suppressTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.dropList.lockAxis = 'y';
    this.dropList.orientation = 'vertical';
    const dropped = this.dropList.dropped.subscribe(event => this.onDrop(event));
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => {
      dropped.unsubscribe();
      clearTimeout(this.suppressTimer);
    });

    if (!isPlatformBrowser(inject(PLATFORM_ID))) {
      return;
    }
    this.reorder.attach(this);
    const click = (event: MouseEvent) => this.onListClickCapture(event);
    this.host.addEventListener('click', click, true);
    destroyRef.onDestroy(() => {
      this.reorder.detach(this);
      this.host.removeEventListener('click', click, true);
    });
  }

  /** @internal Called by `appSelectReorderItem`. */
  registerItem(option: MatOption, element: HTMLElement): void {
    this.items.set(option, element);
  }

  /** @internal Called by `appSelectReorderItem`. */
  unregisterItem(option: MatOption): void {
    this.items.delete(option);
  }

  /** @internal Called by `appSelectReorderItem` when a drag starts. */
  dragStarted(): void {
    this.dragging = true;
  }

  /**
   * @internal Called by `appSelectReorderItem` when a drag ends (dropped or cancelled).
   *
   * The browser fires the click that follows a drag's mouseup synchronously after it, in the same task
   * as CDK's `ended`, so one click is swallowed, and the guard clears on the next macrotask in case no
   * click follows (a touch drag fires none). A deliberate click after that works as normal.
   */
  dragEnded(): void {
    this.dragging = false;
    this.suppressNextClick = true;
    clearTimeout(this.suppressTimer);
    this.suppressTimer = setTimeout(() => {
      this.suppressNextClick = false;
    });
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

  /** @internal Called by `mat-select[appSelectReorder]` for keydowns on the select host (capture phase). */
  handleSelectKeydown(event: KeyboardEvent): void {
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    const step = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
    if (step === 0 || !this.select.panelOpen) {
      return;
    }
    const active = this.activeOption();
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
      this.keepActive(active);
    }
  }

  /**
   * The active option, as mat-select reports it to assistive tech (`aria-activedescendant`). Writing
   * the value makes mat-select clear every option's active styles (`option.active` turns false), while
   * its key manager still points at the moved option, so `aria-activedescendant` is the reliable source.
   */
  private activeOption(): MatOption | undefined {
    const options = this.select.options;
    if (!options) {
      return undefined;
    }
    const id = this.reorder.activeDescendantId();
    return (id ? options.find(option => option.id === id) : undefined) ?? options.find(option => option.active);
  }

  /**
   * After a keyboard move, mat-select re-applies the value (on the write and again, a microtask later,
   * when the regrouped options change) and clears every option's active styles. Its key manager already
   * follows the moved option across the options change, so only the public highlight is restored, after
   * that microtask, and the option is kept in view.
   */
  private keepActive(active: MatOption): void {
    afterNextRender({
      write: () => {
        void Promise.resolve().then(() => {
          const element = this.items.get(active);
          if (!element || !this.select.panelOpen || this.activeOption() !== active) {
            return;
          }
          active.setActiveStyles();
          element.scrollIntoView?.({ block: 'nearest' });
        });
      }
    }, { injector: this.injector });
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

  private onListClickCapture(event: MouseEvent): void {
    if (this.dragging || this.suppressNextClick) {
      // The mouseup that ends a drag must not toggle the option under the pointer.
      this.suppressNextClick = false;
      event.preventDefault();
      event.stopPropagation();
    }
  }
}
