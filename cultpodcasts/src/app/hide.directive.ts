import { Directive, ElementRef, Input, Renderer2 } from '@angular/core';

@Directive({ selector: '[appHide]' })
export class HideDirective {
    @Input() set appHide(shouldHide: boolean) {
        (shouldHide)
            ? this.renderer2.setStyle(this.elRef.nativeElement, 'display', 'none')
            : this.renderer2.removeStyle(this.elRef.nativeElement, 'display');
    }

    constructor(private elRef: ElementRef, private renderer2: Renderer2) { }
}