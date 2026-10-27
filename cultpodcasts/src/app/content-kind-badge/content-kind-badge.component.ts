import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { contentKindIcon, contentKindLabel } from '../content-kind-label';

/**
 * Kind badge for catalogue playables (HERO-KND-001): an icon plus "News", "TV" or "Film",
 * using the same icons as the cards and search suggestions. Renders nothing for a podcast
 * episode or a missing or unknown kind. The host is `display: contents`, so the optional
 * separator and the badge become items of the parent's flex row (e.g. the hero eyebrow).
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

  /** Puts a middle-dot separator in front, as after "Now featuring". */
  readonly separator = input(false);

  protected readonly icon = computed(() => contentKindIcon(this.kind()));

  protected readonly label = computed(() => {
    const kind = this.kind();
    return kind ? contentKindLabel(kind) : '';
  });
}
