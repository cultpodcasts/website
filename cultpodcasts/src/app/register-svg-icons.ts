import { ENVIRONMENT_INITIALIZER, inject, type EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { svgIconLiterals } from './svg-icon-literals';

/**
 * Register Material SVG icons as string literals so MatIconRegistry never
 * HTTP-fetches during SSR/prerender (which has no asset server).
 *
 * Regenerate after editing src/assets/*.svg or streamingIconSvgs in the
 * generator (do not hand-edit svg-icon-literals.ts):
 *   npm run generate:svg-icons
 */
export function registerSvgIcons(
  iconRegistry: MatIconRegistry,
  domSanitizer: DomSanitizer,
): void {
  for (const [name, svg] of svgIconLiterals) {
    iconRegistry.addSvgIconLiteral(name, domSanitizer.bypassSecurityTrustHtml(svg));
  }
}

/**
 * Same registration as {@link registerSvgIcons}, as an environment initializer.
 * Production still calls {@link registerSvgIcons} from `AppComponent` (eager boot);
 * unit tests add this via `src/testing/vitest-setup.ts` so every TestBed matches
 * the live icon set and MatIcon never logs `Error retrieving icon :name`.
 */
export function provideAppSvgIcons(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        registerSvgIcons(inject(MatIconRegistry), inject(DomSanitizer));
      },
    },
  ]);
}
