import {
  AfterViewInit,
  Directive,
  ElementRef,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';

/**
 * Adds `.browse-facet__scroller--overflow` when facet pills exceed the row width,
 * so the fade mask only appears when scrolling is actually needed.
 */
@Directive({
  selector: '.browse-facet__scroller',
  standalone: true,
  host: {
    '[class.browse-facet__scroller--overflow]': 'overflows()',
  },
})
export class BrowseFacetScrollerDirective implements AfterViewInit, OnDestroy {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly overflows = signal(false);

  private resizeObserver?: ResizeObserver;
  private mutationObserver?: MutationObserver;
  private measureRaf = 0;

  ngAfterViewInit(): void {
    const node = this.el.nativeElement;
    this.scheduleMeasure();

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.scheduleMeasure());
      this.resizeObserver.observe(node);
    }

    if (typeof MutationObserver !== 'undefined') {
      this.mutationObserver = new MutationObserver(() => this.scheduleMeasure());
      this.mutationObserver.observe(node, { childList: true, subtree: true, characterData: true });
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
    if (this.measureRaf) {
      cancelAnimationFrame(this.measureRaf);
    }
  }

  private scheduleMeasure(): void {
    if (this.measureRaf) {
      cancelAnimationFrame(this.measureRaf);
    }
    this.measureRaf = requestAnimationFrame(() => {
      this.measureRaf = 0;
      this.measure();
    });
  }

  private measure(): void {
    const node = this.el.nativeElement;
    this.overflows.set(node.scrollWidth > node.clientWidth + 1);
  }
}
