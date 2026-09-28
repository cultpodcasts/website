import { ChangeDetectionStrategy, Component, computed, inject } from "@angular/core";
import { PlayerService } from "../player.service";
import { EpisodePlayerComponent } from "../episode-player/episode-player.component";
import { catalogueParentLink, cataloguePlayableLink } from "../catalogue-links";

/** Chooses the parent and page links for whatever is playing. The player does not. */
@Component({
  selector: "app-now-playing",
  imports: [EpisodePlayerComponent],
  templateUrl: "./now-playing.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NowPlayingComponent {
  private readonly player = inject(PlayerService);
  protected readonly parent = computed(() => catalogueParentLink(this.player.episode()));
  protected readonly page = computed(() => {
    const episode = this.player.episode();
    return episode ? cataloguePlayableLink(episode) : null;
  });
}
