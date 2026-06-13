import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-clampable-text',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './clampable-text.component.html',
  styleUrl: './clampable-text.component.sass'
})
export class ClampableTextComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() maxLines: number = 6;
  @Input() html: string | null | undefined;

  @ViewChild('content') contentRef!: ElementRef<HTMLElement>;

  expanded = false;
  showToggle = false;
  private resizeObserver: ResizeObserver | undefined;
  private wasTruncated = false;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['html'] || changes['maxLines']) {
      this.expanded = false;
      this.wasTruncated = false;
      this.showToggle = false;
      queueMicrotask(() => this.updateTruncation());
    }
  }

  ngAfterViewInit() {
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.updateTruncation());
      this.resizeObserver.observe(this.contentRef.nativeElement);
    }
    this.updateTruncation();
  }

  ngOnDestroy() {
    this.resizeObserver?.disconnect();
  }

  toggle(event: Event) {
    event.stopPropagation();
    this.expanded = !this.expanded;
    if (!this.expanded) {
      queueMicrotask(() => this.updateTruncation());
    }
  }

  private updateTruncation() {
    const element = this.contentRef?.nativeElement;
    if (!element) {
      return;
    }

    if (this.expanded) {
      this.showToggle = this.wasTruncated;
      return;
    }

    const truncated = element.scrollHeight > element.clientHeight + 1;
    if (truncated) {
      this.wasTruncated = true;
    }
    this.showToggle = this.wasTruncated;
  }
}
