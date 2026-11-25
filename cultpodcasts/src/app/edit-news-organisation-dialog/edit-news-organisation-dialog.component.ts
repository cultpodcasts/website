import { afterNextRender, ChangeDetectionStrategy, Component, ElementRef, inject, Injector, signal } from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { FormsModule } from "@angular/forms";
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
import { NewsOrganisationDto, PlaylistIdHistoryEntry } from "../catalogue-parent.interface";
import { EditCatalogueParentDialogData, EditCatalogueParentDialogResponse } from "../catalogue-parent-edit-dialog-data";
import { YouTubeIndexingHints } from "../youtube-indexing-hints.interface";
import { effectiveYouTubeIndexingHints } from "../youtube-indexing-hints.util";
import {
  AdditionalYouTubeChannelRow,
  additionalYouTubeChannelsError,
  NewsOrganisationEditModel,
  newsOrganisationChanges,
  newsOrganisationEditModel,
  isValidAppleIdText,
  isValidDurationText,
  removesCatalogueParent,
  subjectOptions
} from "../catalogue-parent-edit";
import { catalogueParentSaveError } from "../catalogue-parent-save-error";
import { CatalogueParentEditor } from "../catalogue-parent-editor";
import { confirmCatalogueParentRemoval, forceFullCatalogueParentYouTubeWalk, loadNamedCatalogueParent } from "../catalogue-parent-edit-flow";
import { CatalogueParentFieldsComponent } from "../catalogue-parent-fields/catalogue-parent-fields.component";
import { CurationSubmitService } from "../curation-submit.service";
import { buildPodcastLanguageOptions } from "../language-options.util";
import { RegexPresetsService } from "../regex-presets.service";
import { PODCAST_DETAILS_TAB_INDEX, PODCAST_META_TAB_INDEX } from "../podcast-form.util";
import { YOU_TUBE_PLAYLIST_NOT_FOUND, youtubePlaylistEditError } from "../youtube-playlist-edit-error";

/**
 * Curator edit of a news organisation (PATCH, RPP #1053 / #1370). Same tabbed layout as the podcast edit dialog:
 * Details (service ids, YouTube publication delay, additional YouTube channels each with an optional playlist id that
 * scopes that channel; the top-level playlist id scopes only the main channel), Flags (Index All Episodes, Bypass
 * Short Episode Checking, Always promote as hero, Ignore All Episodes; Skip Enriching From YouTube is podcast-only),
 * Subjects, Social, Meta (incl. release authority and minimum duration) and Regexs.
 * Rename is a separate admin dialog. Default/ignored subjects and language use the podcast dialog's selects.
 */
@Component({
  selector: "app-edit-news-organisation-dialog",
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    CatalogueParentFieldsComponent
  ],
  templateUrl: "./edit-news-organisation-dialog.component.html",
  styleUrl: "../catalogue-parent-edit-dialog.sass",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditNewsOrganisationDialogComponent {
  protected readonly data = inject<EditCatalogueParentDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<EditNewsOrganisationDialogComponent, EditCatalogueParentDialogResponse>>(MatDialogRef);
  private readonly curation = inject(CurationSubmitService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly regexPresetsService = inject(RegexPresetsService);
  protected editor!: CatalogueParentEditor;
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly label = hubParentLabel("news");
  protected readonly isLoading = signal(true);
  protected readonly isSending = signal(false);
  protected readonly notFound = signal(false);
  protected readonly conflict = signal(false);
  protected readonly isInError = signal(false);
  protected readonly saveError = signal(false);
  /** Curator-facing save failure copy; playlist ownership codes replace the generic line. */
  protected readonly saveErrorMessage = signal("Saving failed. Nothing was changed.");
  protected readonly model = signal<NewsOrganisationEditModel | null>(null);
  protected readonly appleIdInvalid = signal(false);
  /** Why the additional YouTube channel rows cannot be saved (Details tab), or null. */
  protected readonly additionalChannelsError = signal<string | null>(null);
  /** Minimum Duration (Meta tab) and YouTube Publication Delay (Details tab) are validated separately so each tab shows only its own error. */
  protected readonly minimumDurationInvalid = signal(false);
  protected readonly publicationDelayInvalid = signal(false);
  protected addAdditionalYouTubeChannel(): void {
    const model = this.model();
    if (!model) {
      return;
    }
    this.model.set({
      ...model,
      additionalYouTubeChannels: [...model.additionalYouTubeChannels, { youTubeChannelId: "", youTubePlaylistId: "" }]
    });
    this.additionalChannelsError.set(null);
    const index = model.additionalYouTubeChannels.length;
    // Zoneless: the new row exists only after the next render, so focus it then (a microtask runs too early).
    afterNextRender(
      () => {
        this.host.nativeElement.querySelector<HTMLInputElement>(`input[name="additionalYouTubeChannelId${index}"]`)?.focus();
      },
      { injector: this.injector }
    );
  }

  protected setAdditionalYouTubeChannel(index: number, value: string): void {
    this.updateAdditionalYouTubeChannelRow(index, { youTubeChannelId: value });
  }

  protected setAdditionalYouTubePlaylist(index: number, value: string): void {
    this.updateAdditionalYouTubeChannelRow(index, { youTubePlaylistId: value });
  }

  private updateAdditionalYouTubeChannelRow(index: number, change: Partial<AdditionalYouTubeChannelRow>): void {
    const model = this.model();
    if (!model) {
      return;
    }
    const rows = model.additionalYouTubeChannels.map((row, i) => (i === index ? { ...row, ...change } : row));
    this.model.set({ ...model, additionalYouTubeChannels: rows });
    this.additionalChannelsError.set(null);
  }

  protected removeAdditionalYouTubeChannel(index: number): void {
    const model = this.model();
    if (!model) {
      return;
    }
    this.model.set({
      ...model,
      additionalYouTubeChannels: model.additionalYouTubeChannels.filter((_, i) => i !== index)
    });
    this.additionalChannelsError.set(null);
  }

  protected readonly playlistHistory = signal<PlaylistIdHistoryEntry[]>([]);
  protected readonly indexingHints = signal<YouTubeIndexingHints | null>(null);
  protected readonly clearingIndexingHints = signal(false);
  protected readonly itemNoun = "reports";
  protected readonly selectedTabIndex = signal(0);
  private original: NewsOrganisationDto | null = null;

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
      this.model.set(newsOrganisationEditModel(dto));
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
  private async resolveParentDto(): Promise<NewsOrganisationDto | null> {
    const loaded = await loadNamedCatalogueParent({
      loadByName: async () => (await firstValueFrom(this.curation.getCatalogueParent("news", this.data.name))) as NewsOrganisationDto,
      loadById: async (id) => {
        try {
          return (await firstValueFrom(this.curation.getCatalogueParent("news", id))) as NewsOrganisationDto;
        } catch {
          return null;
        }
      },
      dialog: this.dialog,
      name: this.data.name,
      title: `Choose ${this.label.toLowerCase()}`,
      itemNounPlural: "news outlets",
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

  /**
   * A news organisation may list several additional-channel playlists (RPP #1370), so on not-found append the API
   * message, which names the failing channel. The shared mapping (podcast dialogs, TV shows) keeps the fixed copy.
   */
  private playlistErrorMessage(code: string, message: string, error: unknown): string {
    if (code !== YOU_TUBE_PLAYLIST_NOT_FOUND || !(error instanceof HttpErrorResponse)) {
      return message;
    }
    const body = error.error as Record<string, unknown> | null;
    const apiMessage = body && typeof body === "object" ? body["message"] : undefined;
    return typeof apiMessage === "string" && apiMessage.trim() ? `${message}: ${apiMessage.trim()}` : message;
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
    this.additionalChannelsError.set(
      additionalYouTubeChannelsError(model.additionalYouTubeChannels, model.youTubeChannelId)
    );
    if (this.additionalChannelsError()) {
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
    const changes = newsOrganisationChanges(this.original, model);
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
      const resp = await firstValueFrom(this.curation.patchCatalogueParent("news", this.original.id, changes));
      if (resp.status === 202 || resp.status === 200) {
        this.dialogRef.close({ updated: true });
        return;
      }
      this.saveError.set(true);
    } catch (error) {
      const playlist = youtubePlaylistEditError(error);
      const refused = playlist ? undefined : catalogueParentSaveError(error);
      if (playlist) {
        // Retryable 503: form stays mounted and Save remains enabled (Save-as-retry; podcast send uses an explicit Try again).
        this.saveErrorMessage.set(this.playlistErrorMessage(playlist.code, playlist.message, error));
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
      hub: "news",
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

  /** Removing cascades to every report, so it takes an explicit Yes. Restoring stays one step. */
  private confirmRemove(): Promise<boolean> {
    return confirmCatalogueParentRemoval(this.dialog, this.label, this.data.name, this.itemNoun);
  }

  protected close(): void {
    this.dialogRef.close({ closed: true });
  }
}
