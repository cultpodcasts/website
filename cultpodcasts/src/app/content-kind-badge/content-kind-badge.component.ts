import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { contentKindIcon, contentKindLabel } from '../content-kind-label';

/**
 * Kind badge for catalogue playables (HERO-KND-001 / HERO-SER-*): an icon plus "News", "TV"
 * or "Film", using the same icons as the cards and search suggestions. Renders nothing for a
 * podcast episode or a missing or unknown kind. The host is `inline-flex` (a real flex item
 * on `.hero-show`) — not `display: contents`, which Firefox mis-sizes in flex rows.
 */
@Component({
  selector: 'app-content-kind-badge',
  imports: [MatIconModule],
  templateUrl: './content-kind-badge.component.html',
  styleUrl: './content-kind-badge.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContentKindBadgeComponent {
  /** `contentKind` of the playable (NewsReport / TvShowEpisode / Film). Absent means podcast. */
  readonly kind = input<string | null | undefined>(undefined);

  protected readonly icon = computed(() => contentKindIcon(this.kind()));

  protected readonly label = computed(() => {
    const kind = this.kind();
    return kind ? contentKindLabel(kind) : '';
  });
}
