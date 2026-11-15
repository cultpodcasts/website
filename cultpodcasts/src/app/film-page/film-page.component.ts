import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatDialog } from "@angular/material/dialog";
import { RouterLink } from "@angular/router";
import { MatSnackBar } from "@angular/material/snack-bar";
import { Router } from "@angular/router";
import { SiteLoadingComponent } from "../site-loading/site-loading.component";
import { EpisodeLoadingSkeletonComponent } from "../episode-loading-skeleton/episode-loading-skeleton.component";
import { PlayableDetailFilmComponent } from "../playable-detail-film/playable-detail-film.component";
import { connectKindEpisode } from "../kind-episode-page";
import { editCataloguePlayableFromPage } from "../catalogue-playable-edit";
import { CataloguePlayableKind } from "../catalogue-playable-kind.enum";
import { FilmTrailersComponent } from "../film-trailers/film-trailers.component";
import { SearchResult } from "../search-result.interface";

/**
 * /film/{title}/{short id}: film detail leaf + shared shell. Curator Edit opens
 * the film dialog (film/{id}); Post Film uses the shared publish dialog (GET episode/{id}, POST film/{id}/publish). Projected into the shell
 * under the hero, above the related rails, the Trailers rail shows the film's trailers from its search document.
 */
@Component({
  selector: "app-film-page",
  templateUrl: "./film-page.component.html",
  styleUrl: "./film-page.component.sass",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatButtonModule, SiteLoadingComponent, EpisodeLoadingSkeletonComponent, PlayableDetailFilmComponent, FilmTrailersComponent],
})
export class FilmPageComponent {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly page = connectKindEpisode({
    parentHub: () => null,
    seoName: (episode) => episode.episodeTitle || "Film",
    contentKind: "Film",
  });
  protected readonly slug = this.page.slug;
  protected readonly episode = this.page.episode;
  protected readonly isLoading = this.page.isLoading;
  protected readonly isEpisode = this.page.isEpisode;
  protected readonly showEpisodeSkeleton = this.page.showEpisodeSkeleton;
  protected readonly parentHub = this.page.parentHub;
  protected readonly displayCatalogName = this.page.displayCatalogName;

  /** RedditPodcastPoster#1431: the film's other titles from its search document, or null when it has none. */
  protected alsoKnownAs(film: SearchResult): string | null {
    const titles = (film.alternativeTitles ?? []).map(title => title.trim()).filter(title => title.length > 0);
    return titles.length > 0 ? titles.join(" · ") : null;
  }

  ngOnInit(): void {
    this.page.start();
  }

  /** Curator Edit: the film dialog (film/{id}), then Review on `/episodes`. */
  editFilm(filmId: string): void {
    editCataloguePlayableFromPage(this.dialog, this.snackBar, this.router, CataloguePlayableKind.Film, filmId);
  }
}
