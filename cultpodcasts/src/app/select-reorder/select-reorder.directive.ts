import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, Directive, ElementRef, inject, PLATFORM_ID } from '@angular/core';
import { MatSelect } from '@angular/material/select';

/** What `mat-select[appSelectReorder]` forwards its host keydowns to (the list inside its panel). */
export interface SelectReorderKeyHandler {
  /** Handle a keydown on the select host in the capture phase. Stop it when handled. */
  handleSelectKeydown(event: KeyboardEvent): void;
}

/**
 * Put on a multi `mat-select` whose selected options sit in an `appSelectReorderList`.
 *
 * Focus stays on the `mat-select` host while its panel is open (options are aria-activedescendant),
 * so the keyboard reorder has to listen on this element. It listens in the **capture** phase:
 * at-target capture listeners run before mat-select's own bubbling `(keydown)` host listener.
 *
 * Material dependency to recheck on upgrades: `MatSelect._handleOpenKeydown` closes the panel on
 * Alt+ArrowUp / Alt+ArrowDown. The reorder list stops those keys first (only for a selected,
 * reorderable active option); every other key, and Alt+Arrow on any other option, reaches mat-select
 * unchanged. The spec "Alt+Arrow on an option that is not selected keeps mat-select behaviour" is the
 * canary for that behaviour.
 */
@Directive({
  selector: 'mat-select[appSelectReorder]'
})
export class SelectReorderDirective {
  readonly select = inject(MatSelect, { self: true });
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private handler: SelectReorderKeyHandler | null = null;

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) {
      return;
    }
    const host = this.host;
    const keydown = (event: KeyboardEvent) => this.handler?.handleSelectKeydown(event);
    host.addEventListener('keydown', keydown, true);
    inject(DestroyRef).onDestroy(() => host.removeEventListener('keydown', keydown, true));
  }

  /**
   * The id of the option the select reports as active to assistive tech (`aria-activedescendant` on the
   * host, kept by mat-select's key manager while the panel is open).
   */
  activeDescendantId(): string | null {
    return this.host.getAttribute('aria-activedescendant');
  }

  /** @internal Called by `appSelectReorderList`. */
  attach(handler: SelectReorderKeyHandler): void {
    this.handler = handler;
  }

  /** @internal Called by `appSelectReorderList`. */
  detach(handler: SelectReorderKeyHandler): void {
    if (this.handler === handler) {
      this.handler = null;
    }
  }
}
