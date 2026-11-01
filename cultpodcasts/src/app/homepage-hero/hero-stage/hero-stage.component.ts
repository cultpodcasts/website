import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * One crossfade layer of the homepage hero's art band (`.billboard__stages` holds two).
 * Paints the sharp art, the blurred side fills and the Ken Burns motion. The parent
 * (`app-homepage-hero`) owns which layer is in front, its image, its aspect and whether
 * it zooms; this component only renders them. Its styles live here, not in the hero's
 * stylesheet, so the hero stays inside the `anyComponentStyle` budget (#568).
 * The host keeps the `billboard__stage` class and its state classes, so the hero's
 * contracts and the layout harness still see `.billboard__stage.is-active` etc.
 */
@Component({
  selector: 'app-hero-stage',
  templateUrl: './hero-stage.component.html',
  styleUrl: './hero-stage.component.sass',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'billboard__stage',
    '[class.is-active]': 'active()',
    '[class.is-kenburns]': 'kenBurns()',
    '[class.has-edge-extend]': 'aspect() != null',
    '[style.--hero-art-aspect]': 'aspect() ?? null',
  },
})
export class HeroStageComponent {
  /** Art URL for this layer; unset leaves the layer blank. */
  readonly image = input<string | undefined>(undefined);
  /** Width / height of the art once known; turns on the contain framing and edge fills. */
  readonly aspect = input<number | undefined>(undefined);
  /** Front layer of the crossfade. */
  readonly active = input(false);
  /** Ken Burns zoom on this layer (the parent turns it off for reduced motion / save-GPU). */
  readonly kenBurns = input(false);

  protected readonly backgroundImage = computed(() => {
    const image = this.image();
    return image ? 'url(' + image + ')' : null;
  });
}
