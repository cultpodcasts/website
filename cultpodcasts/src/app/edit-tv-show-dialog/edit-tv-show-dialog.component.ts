import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { FormArray, FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatIconModule } from "@angular/material/icon";
import { MatSnackBar } from "@angular/material/snack-bar";
import { MatTabsModule } from "@angular/material/tabs";
import { firstValueFrom, forkJoin } from "rxjs";
import { ambiguousCandidateFromCatalogueParent } from "../ambiguous-name-candidate";
import { hubParentLabel } from "../catalogue-hub";
import { applyIdentityIds, runCatalogueIdentityLookup } from "../catalogue-identity-lookup";
import { PlaylistIdHistoryEntry, TvShowChangeRequest, TvShowDto } from "../catalogue-parent.interface";
import { EditCatalogueParentDialogData, EditCatalogueParentDialogResponse } from "../catalogue-parent-edit-dialog-data";
import { YouTubeIndexingHints } from "../youtube-indexing-hints.interface";
import { effectiveYouTubeIndexingHints } from "../youtube-indexing-hints.util";
import {
  CatalogueParentEditModel,
  catalogueParentChanges,
  catalogueParentEditModel,
  isValidAppleIdText,
  isValidDurationText,
  isValidImdbIdText,
  isValidNumericIdText,
  removesCatalogueParent,
  subjectOptions
} from "../catalogue-parent-edit";
import { catalogueParentSaveError } from "../catalogue-parent-save-error";
import { CatalogueParentEditor } from "../catalogue-parent-editor";
import { confirmCatalogueParentRemoval, forceFullCatalogueParentYouTubeWalk, loadNamedCatalogueParent } from "../catalogue-parent-edit-flow";
import { CatalogueParentFieldsComponent } from "../catalogue-parent-fields/catalogue-parent-fields.component";
import { FilmTrailersEditComponent } from "../film-trailers-edit/film-trailers-edit.component";
import { CurationSubmitService } from "../curation-submit.service";
import { openExternalUrl } from "../episode-form.util";
import { FilmTrailerEditGroup, imdbTitleUrl, newFilmTrailerGroup, tmdbTvShowUrl, tvdbSeriesUrl } from "../playable-edit-form.util";
import { buildPodcastLanguageOptions } from "../language-options.util";
import { RegexPresetsService } from "../regex-presets.service";
import {
  CATALOGUE_PARENT_IDENTITY_TAB_INDEX,
  PODCAST_DETAILS_TAB_INDEX,
  PODCAST_META_TAB_INDEX
} from "../podcast-form.util";
import { staleTvShowTrailersError, tvShowTrailerChanges } from "../tv-show-trailer";
import { youtubePlaylistEditError } from "../youtube-playlist-edit-error";

/** The Trailers tab sits after Identity, so the shared tab indexes above stay valid (RPP #1412). */
export const TV_SHOW_TRAILERS_TAB_INDEX = CATALOGUE_PARENT_IDENTITY_TAB_INDEX + 1;

export { EditCatalogueParentDialogData, EditCatalogueParentDialogResponse } from "../catalogue-parent-edit-dialog-data";

/**
 * Curator edit of a TV show (PATCH, RPP #1053). Same tabbed layout as the podcast edit dialog:
 * Details (service ids, YouTube publication delay), Flags (Index All Episodes, Bypass Short Episode Checking, Always
 * promote as hero, Ignore All Episodes; Skip Enriching From YouTube is podcast-only), Subjects, Social, Meta (incl.
 * release authority and minimum duration), Regexs, Identity and Trailers (rename, reorder, remove; RPP #1412).
 * Rename is a separate admin dialog. Default/ignored subjects and language use the podcast dialog's selects.
 */
@Component({
  selector: "app-edit-tv-show-dialog",
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    CatalogueParentFieldsComponent,
    FilmTrailersEditComponent
  ],
  templateUrl: "./edit-tv-show-dialog.component.html",
  styleUrl: "../catalogue-parent-edit-dialog.sass",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditTvShowDialogComponent {
  protected readonly data = inject<EditCatalogueParentDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<EditTvShowDialogComponent, EditCatalogueParentDialogResponse>>(MatDialogRef);
  private readonly curation = inject(CurationSubmitService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly regexPresetsService = inject(RegexPresetsService);
  protected editor!: CatalogueParentEditor;

  protected readonly label = hubParentLabel("tv");
  protected readonly isLoading = signal(true);
  protected readonly isSending = signal(false);
  protected readonly notFound = signal(false);
  protected readonly conflict = signal(false);
  protected readonly isInError = signal(false);
  protected readonly saveError = signal(false);
  /** Curator-facing save failure copy; playlist ownership codes replace the generic line. */
  protected readonly saveErrorMessage = signal("Saving failed. Nothing was changed.");
  protected readonly model = signal<CatalogueParentEditModel | null>(null);
  protected readonly appleIdInvalid = signal(false);
  protected readonly identityInvalid = signal(false);
  /** Minimum Duration (Meta tab) and YouTube Publication Delay (Details tab) are validated separately so each tab shows only its own error. */
  protected readonly minimumDurationInvalid = signal(false);
  protected readonly publicationDelayInvalid = signal(false);
  protected readonly lookingUpIdentity = signal(false);
  protected readonly identityLookupMessage = signal("");
  protected readonly openExternalUrl = openExternalUrl;
  protected readonly imdbUrl = imdbTitleUrl;
  protected readonly tvdbUrl = tvdbSeriesUrl;
  protected readonly tmdbUrl = tmdbTvShowUrl;

  protected clearIdentityField(field: "imdbId" | "tvdbId" | "tmdbId"): void {
    const model = this.model();
    if (!model) {
      return;
    }
    this.model.set({ ...model, [field]: "" });
    this.identityInvalid.set(false);
  }

  protected readonly playlistHistory = signal<PlaylistIdHistoryEntry[]>([]);
  protected readonly indexingHints = signal<YouTubeIndexingHints | null>(null);
  protected readonly clearingIndexingHints = signal(false);
  protected readonly itemNoun = "episodes";
  protected readonly selectedTabIndex = signal(0);
  private original: TvShowDto | null = null;
  /** The show's trailers to keep, in display order, each with an editable title (the Trailers tab). */
  protected readonly trailers = new FormArray<FilmTrailerEditGroup>([]);

  constructor() {
    this.editor = new CatalogueParentEditor(
      this.regexPresetsService,
      () => this.data.name,
      this.selectedTabIndex,
      (next) => {
        const current = this.model();
        if (current) {
          this.model.set({ ...current, ...next });
        }
      }
    );
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const dto = await this.resolveParentDto();
      if (!dto) {
        return;
      }
      const resp = await firstValueFrom(
        forkJoin({
          subjects: this.curation.getSubjects(),
          languages: this.curation.getLanguages()
        })
      );
      const subjectNames = resp.subjects.map((subject) => subject.name);
      this.original = dto;
      this.model.set(catalogueParentEditModel(dto));
      this.trailers.clear();
      for (const trailer of dto.trailers ?? []) {
        this.trailers.push(newFilmTrailerGroup(trailer.id, trailer.title ?? ""));
      }
      this.trailers.markAsPristine();
      this.editor.defaultSubjects.set(subjectOptions([dto.defaultSubject ?? ""], subjectNames));
      this.editor.ignoredSubjects.set(subjectOptions(dto.ignoredSubjects ?? [], subjectNames));
      this.editor.languages.set(buildPodcastLanguageOptions(resp.languages));
      this.playlistHistory.set(dto.youTubePlaylistIdHistory ?? []);
      this.indexingHints.set(dto.youTubeIndexingHints ?? null);
    } catch (error) {
      const status = error instanceof HttpErrorResponse ? error.status : 0;
      this.notFound.set(status === 404);
      this.conflict.set(status === 409);
      this.isInError.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * GET by hub name; on 409 load each id and let the curator pick (same picker as submit).
   * Cancel closes the edit dialog. Returns null when closed or unrecoverable.
   */
  private async resolveParentDto(): Promise<TvShowDto | null> {
    const loaded = await loadNamedCatalogueParent({
      loadByName: () => firstValueFrom(this.curation.getCatalogueParent("tv", this.data.name)),
      loadById: async (id) => {
        try {
          return await firstValueFrom(this.curation.getCatalogueParent("tv", id));
        } catch {
          return null;
        }
      },
      dialog: this.dialog,
      name: this.data.name,
      title: `Choose ${this.label.toLowerCase()}`,
      itemNounPlural: "TV shows",
      toCandidate: ambiguousCandidateFromCatalogueParent,
      onCancelled: () => this.dialogRef.close({ closed: true })
    });
    if (loaded.kind === "loaded") {
      return loaded.row;
    }
    if (loaded.kind === "unrecoverable") {
      this.conflict.set(true);
      this.isInError.set(true);
    }
    return null;
  }

  protected async lookUpIdentity(): Promise<void> {
    if (this.lookingUpIdentity()) {
      return;
    }
    const model = this.model();
    const title = (this.original?.name ?? this.data.name).trim();
    if (!model || !title) {
      this.identityLookupMessage.set("Show name is required before looking up identity.");
      return;
    }
    this.lookingUpIdentity.set(true);
    this.identityLookupMessage.set("");
    try {
      const outcome = await runCatalogueIdentityLookup(
        this.dialog,
        (body) => this.curation.lookupCatalogueIdentity(body),
        { kind: "TvShow", title }
      );
      if (outcome.kind === "cancelled") {
        return;
      }
      if (outcome.kind === "noMatch" || outcome.kind === "error") {
        this.identityLookupMessage.set(outcome.message);
        this.snackBar.open(outcome.message, "Ok", { duration: 8000 });
        return;
      }
      const filled = applyIdentityIds(
        { imdbId: model.imdbId, tmdbId: model.tmdbId, tvdbId: model.tvdbId },
        outcome.ids
      );
      if (!filled.changed) {
        const msg = "Lookup matched, but no blank identity fields to fill.";
        this.identityLookupMessage.set(msg);
        this.snackBar.open(msg, "Ok", { duration: 8000 });
        return;
      }
      this.model.set({
        ...model,
        imdbId: filled.imdbId ?? model.imdbId,
        tmdbId: filled.tmdbId ?? model.tmdbId,
        tvdbId: filled.tvdbId ?? model.tvdbId
      });
      this.identityInvalid.set(false);
      const msg = "Filled blank show identity. Save to keep.";
      this.identityLookupMessage.set(msg);
      this.snackBar.open(msg, "Ok", { duration: 8000 });
    } finally {
      this.lookingUpIdentity.set(false);
    }
  }

  protected async save(): Promise<void> {
    const model = this.model();
    if (!model || !this.original) {
      return;
    }
    this.appleIdInvalid.set(!isValidAppleIdText(model.appleId));
    if (this.appleIdInvalid()) {
      // Apple Id is on Details; switch so the error is visible when Save is blocked from another tab.
      this.selectedTabIndex.set(PODCAST_DETAILS_TAB_INDEX);
      return;
    }
    this.minimumDurationInvalid.set(!isValidDurationText(model.minimumDuration));
    this.publicationDelayInvalid.set(!isValidDurationText(model.youTubePublicationDelay));
    if (this.minimumDurationInvalid() || this.publicationDelayInvalid()) {
      // Publication delay (Details) before minimum duration (Meta) when both are invalid.
      this.selectedTabIndex.set(
        this.publicationDelayInvalid() ? PODCAST_DETAILS_TAB_INDEX : PODCAST_META_TAB_INDEX
      );
      return;
    }
    this.identityInvalid.set(
      !(isValidImdbIdText(model.imdbId) && isValidNumericIdText(model.tvdbId) && isValidNumericIdText(model.tmdbId))
    );
    if (this.identityInvalid()) {
      this.selectedTabIndex.set(CATALOGUE_PARENT_IDENTITY_TAB_INDEX);
      return;
    }
    if (this.trailers.invalid) {
      // A blank trailer title is omitted from the patch (the server would keep the old one), so Save is blocked.
      this.trailers.markAllAsTouched();
      this.selectedTabIndex.set(TV_SHOW_TRAILERS_TAB_INDEX);
      return;
    }
    const changes: TvShowChangeRequest = catalogueParentChanges(this.original, model, true);
    const trailers = tvShowTrailerChanges(this.original, this.trailers.getRawValue());
    if (trailers) {
      changes.trailers = trailers;
      // The ids this editor loaded, not the keep-list: a trailer attached since is absent here, so the server refuses
      // (409, nothing saved) instead of deleting a trailer the curator has not seen.
      changes.expectedTrailerIds = (this.original.trailers ?? []).map((trailer) => trailer.id);
    }
    if (Object.keys(changes).length === 0) {
      this.dialogRef.close({ noChange: true });
      return;
    }
    if (removesCatalogueParent(changes) && !(await this.confirmRemove())) {
      return;
    }
    this.isSending.set(true);
    this.saveError.set(false);
    this.saveErrorMessage.set("Saving failed. Nothing was changed.");
    try {
      const resp = await firstValueFrom(this.curation.patchCatalogueParent("tv", this.original.id, changes));
      if (resp.status === 202 || resp.status === 200) {
        this.dialogRef.close({ updated: true });
        return;
      }
      this.saveError.set(true);
    } catch (error) {
      const stale = staleTvShowTrailersError(error);
      const playlist = stale ? undefined : youtubePlaylistEditError(error);
      const refused = stale || playlist ? undefined : catalogueParentSaveError(error);
      if (stale) {
        this.saveErrorMessage.set(stale);
      } else if (playlist) {
        // Retryable 503: form stays mounted and Save remains enabled (Save-as-retry; podcast send uses an explicit Try again).
        this.saveErrorMessage.set(playlist.message);
      } else if (refused) {
        // Channel / service-id refusals (400 codes, 409 owner): show the API's reason so the curator can fix the id.
        this.saveErrorMessage.set(refused);
      }
      this.saveError.set(true);
    } finally {
      this.isSending.set(false);
    }
  }

  protected displayIndexingHints(): YouTubeIndexingHints | null {
    return effectiveYouTubeIndexingHints(this.indexingHints(), this.model()?.youTubePlaylistId);
  }

  /** Clears indexer hints immediately so the next hourly pass walks the playlist in full. */
  protected async forceFullYouTubeWalk(): Promise<void> {
    if (!this.original || this.clearingIndexingHints() || !this.displayIndexingHints()) {
      return;
    }
    const result = await forceFullCatalogueParentYouTubeWalk({
      hub: "tv",
      parentId: this.original.id,
      dialog: this.dialog,
      curation: this.curation,
      snackBar: this.snackBar,
      clearing: this.clearingIndexingHints
    });
    if (result.kind === "refreshed") {
      this.indexingHints.set(result.hints);
      this.original = { ...this.original, youTubeIndexingHints: result.hints };
    }
  }

  /** Removing cascades to every episode, so it takes an explicit Yes. Restoring stays one step. */
  private confirmRemove(): Promise<boolean> {
    return confirmCatalogueParentRemoval(this.dialog, this.label, this.data.name, this.itemNoun);
  }

  protected close(): void {
    this.dialogRef.close({ closed: true });
  }
}
