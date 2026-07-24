import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { displayCatalogName } from '../display-catalog-name';
import { subjectColor } from '../subject-color';

/**
 * Subject label with its deterministic colour, linking to the subject page.
 * Shared so every surface that shows a subject — episode cards, homepage billboard,
 * episode heroes — colours the same subject the same way.
 */
@Component({
  selector: 'app-subject-chip',
  imports: [RouterLink],
  templateUrl: './subject-chip.component.html',
  styleUrl: './subject-chip.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.subject-chip-host--hero]': 'size() === "hero"',
  },
})
export class SubjectChipComponent {
  /** Canonical subject name — also the route segment and the colour seed. */
  readonly subject = input.required<string>();

  /**
   * `hero` matches former glass-pill scale on billboards / episode heroes;
   * default matches episode-poster chips.
   */
  readonly size = input<'default' | 'hero'>('default');

  protected readonly label = computed(() => displayCatalogName(this.subject()));

  protected readonly color = computed(() => subjectColor(this.subject()));
}
