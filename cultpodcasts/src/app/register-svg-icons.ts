import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { svgIconLiterals } from './svg-icon-literals';

/**
 * Register Material SVG icons as string literals so MatIconRegistry never
 * HTTP-fetches during SSR/prerender (which has no asset server).
 *
 * Regenerate literals after editing src/assets/*.svg:
 *   node tools/generate-svg-icon-literals.mjs
 */
export function registerSvgIcons(
  iconRegistry: MatIconRegistry,
  domSanitizer: DomSanitizer,
): void {
  for (const [name, svg] of svgIconLiterals) {
    iconRegistry.addSvgIconLiteral(name, domSanitizer.bypassSecurityTrustHtml(svg));
  }
}
