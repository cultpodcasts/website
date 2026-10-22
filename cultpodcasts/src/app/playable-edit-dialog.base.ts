import { Directive, inject, OnInit, signal } from '@angular/core';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { FormGroup } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { Observable, catchError, firstValueFrom, forkJoin, of } from 'rxjs';
import { CatalogueHub } from './catalogue-hub';
import { CurationSubmitService } from './curation-submit.service';
import { mergeEpisodeSubjects } from './episode-form.util';
import { buildEpisodeLanguageOptions } from './language-options.util';
import { Person } from './person.interface';
import { Subject } from './subject.interface';
import { buildPlayableEditForm, PlayableEditForm, PlayableEditFormValue, PlayableEditVariant } from './playable-edit-form.util';
import {
  EditPlayableDialogResponse,
  PlayableChangeResponse,
  PlayableFieldsChangeRequest,
  PlayableFieldsDto
} from './playable-edit.interface';

export function playableEditApiErrorMessage(error: unknown): string | undefined {
  if (!(error instanceof HttpErrorResponse)) {
    return undefined;
  }
  const body = error.error;
  if (typeof body === 'string' && body.trim()) {
    return body;
  }
  if (body && typeof body.message === 'string' && body.message.trim()) {
    return body.message;
  }
  return undefined;
}

/**
 * Load / save shared by the news report, TV episode and film edit dialogs. Loads the playable GET plus the
 * same `/subjects`, `/people` and `/languages` lookups as the podcast Edit Episode dialog (and the
 * parent's default subject, best-effort), then PATCHes only the changed fields.
 */
@Directive()
export abstract class PlayableEditDialogBase<TDto extends PlayableFieldsDto, TChange extends PlayableFieldsChangeRequest>
  implements OnInit {
  protected readonly curation = inject(CurationSubmitService);
  protected readonly dialogRef = inject<MatDialogRef<unknown, EditPlayableDialogResponse>>(MatDialogRef);

  readonly isLoading = signal(true);
  readonly isInError = signal(false);
  readonly isSaving = signal(false);
  readonly submitError = signal('');
  readonly form = signal<FormGroup<PlayableEditForm> | undefined>(undefined);
  readonly parentName = signal('');
  readonly subjectNames = signal<string[]>([]);
  readonly defaultSubject = signal<string | null>(null);
  readonly people = signal<Person[]>([]);
  readonly languages = signal<Record<string, string>>({});
  readonly blueskyPosted = signal(false);
  readonly pendingUnBluesky = signal(false);
  protected original: TDto | undefined;

  /** Parent hub for the default-subject lookup; null for films (no parent). */
  protected abstract readonly hub: CatalogueHub | null;
  /** News, TV (IMDb + TheTVDB) or film (IMDb, publisher, read-only name, year-or-date release). */
  protected abstract readonly variant: PlayableEditVariant;
  protected abstract playableId(): string;
  protected abstract load(id: string): Observable<TDto>;
  protected abstract patch(id: string, changes: TChange): Observable<HttpResponse<PlayableChangeResponse | null>>;
  protected abstract changes(original: TDto, value: PlayableEditFormValue, pendingUnBluesky: boolean): TChange;
  protected abstract parentOf(dto: TDto): { id: string; name: string };

  /** Default subject carried on the item itself (a film is its own publisher); parents are looked up instead. */
  protected ownDefaultSubject(_dto: TDto): string | null {
    return null;
  }

  async ngOnInit(): Promise<void> {
    try {
      const resp = await firstValueFrom(forkJoin({
        dto: this.load(this.playableId()),
        subjects: this.curation.getSubjects(),
        people: this.curation.getPeople(),
        languages: this.curation.getLanguages()
      }));
      const parent = this.parentOf(resp.dto);
      const hub = this.hub;
      const defaultSubject = hub && parent.id
        ? await firstValueFrom(this.curation.getCatalogueParent(hub, parent.id).pipe(catchError(() => of(null))))
          .then((p) => p?.defaultSubject ?? null)
        : this.ownDefaultSubject(resp.dto);
      this.original = resp.dto;
      this.parentName.set(parent.name);
      this.defaultSubject.set(defaultSubject);
      const { allSubjects } = mergeEpisodeSubjects(resp.dto.subjects ?? [], resp.subjects as Subject[], defaultSubject);
      this.subjectNames.set(allSubjects);
      this.people.set(resp.people ?? []);
      this.languages.set(buildEpisodeLanguageOptions(resp.languages ?? {}));
      this.blueskyPosted.set(!!resp.dto.blueskyPosted);
      this.pendingUnBluesky.set(false);
      this.form.set(buildPlayableEditForm(resp.dto, this.variant));
      this.isLoading.set(false);
    } catch (e) {
      console.error(e);
      this.isLoading.set(false);
      this.isInError.set(true);
    }
  }

  close(): void {
    this.dialogRef.close({ closed: true });
  }

  async onSubmit(): Promise<void> {
    const form = this.form();
    if (!form || !form.valid || !this.original || this.isSaving()) {
      return;
    }
    const changes = this.changes(this.original, form.getRawValue(), this.pendingUnBluesky());
    if (Object.keys(changes).length === 0) {
      this.dialogRef.close({ noChange: true, parentName: this.parentName() });
      return;
    }
    this.isSaving.set(true);
    this.submitError.set('');
    try {
      const response = await firstValueFrom(this.patch(this.playableId(), changes));
      const body = response.body ?? null;
      if (body && (body.tweetDeleted === false || body.blueskyPostDeleted === false)) {
        console.error('Failure to remove tweet/bluesky-post', body);
      }
      this.dialogRef.close({ updated: true, response: body, parentName: this.parentName() });
    } catch (e) {
      console.error(e);
      this.isSaving.set(false);
      if (e instanceof HttpErrorResponse && e.status === 400) {
        this.submitError.set(playableEditApiErrorMessage(e) ?? 'The change was rejected');
        return;
      }
      this.submitError.set('An error occurred saving the change');
    }
  }
}
