import { Component, Inject, ChangeDetectionStrategy, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { SubjectForm } from '../subject-form.interface';
import { SubjectEntity } from '../subject-entity.interface';
import { SubjectResponse } from '../subject-response.interface';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from './../../environments/environment';
import { EditSubjectSendComponent, EditSubjectSendResult } from '../edit-subject-send/edit-subject-send.component';
import { Flair } from '../flair.interface';
import { MatSelectModule } from '@angular/material/select';
import { KeyValuePipe } from '@angular/common';
import { SubjectType } from "../subject-type.enum";
import { CdkTextareaAutosize, TextFieldModule } from '@angular/cdk/text-field';
import { MatInputModule } from '@angular/material/input';
import { asEmptyString, asStringArray, emptyGuidIfBlank } from '../form-value.util';
import { ensureHashPrefix, hashPrefixedTagValidator, normalizeHashTagControl } from '../podcast-form.util';
import { FeatureSwitch } from '../feature-switch.enum';
import { FeatureSwitchService } from '../feature-switch-service';

export interface EditSubjectDialogData {
  subjectName?: string;
  create?: boolean;
  /**
   * Subject loaded with GET /subject/{name}. When `id` is set, the dialog binds
   * this read model and does not GET again.
   */
  subject?: SubjectResponse & { id: string };
}

export interface EditSubjectDialogResult {
  updated?: boolean;
  subjectName?: string;
  subject?: SubjectResponse & { id: string };
  conflict?: string;
  noChange?: boolean;
  closed?: boolean;
}

/**
 * Snackbar Edit after create. `subject` is the GET read model. The dialog skips
 * another name GET only when `id` is set.
 */
export interface EditCreatedSubjectDialogData {
  subject: (SubjectResponse & { id: string }) | undefined;
  subjectName?: string;
}

@Component({
  selector: 'app-edit-subject-dialog',
  imports: [
    MatDialogModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    ReactiveFormsModule,
    MatTabsModule,
    MatFormFieldModule,
    MatSelectModule,
    KeyValuePipe,
    CdkTextareaAutosize,
    TextFieldModule,
    MatInputModule
  ],
  templateUrl: './edit-subject-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './edit-subject-dialog.component.sass'
})
export class EditSubjectDialogComponent {
  protected FeatureSwitch = FeatureSwitch;
  subjectName: string | undefined;
  isLoading = signal(true);
  isInError = signal(false);
  subjectTypes = Object
    .values(SubjectType)
    .filter(value => typeof value !== 'number')
    .map(x => x as keyof typeof SubjectType)

  form = signal<FormGroup<SubjectForm> | undefined>(undefined);
  originalSubject: SubjectResponse | SubjectEntity | undefined;
  subjectId: string | undefined;
  create: boolean;
  conflict: string | undefined;
  flairs = signal<Map<string, Flair>>(new Map<string, Flair>());

  constructor(
    private auth: AuthServiceWrapper,
    private http: HttpClient,
    private dialogRef: MatDialogRef<EditSubjectDialogComponent, EditSubjectDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: EditSubjectDialogData,
    private dialog: MatDialog,
    protected featureSwitchService: FeatureSwitchService,
  ) {
    this.subjectName = data.subject?.name ?? data.subjectName;
    this.create = data.create || false;
  }

  ngOnInit() {
    this.isLoading.set(true);
    var token = firstValueFrom(this.auth.authService.getAccessTokenSilently({
      authorizationParams: {
        audience: `https://api.cultpodcasts.com/`,
        scope: 'curate'
      }
    }));
    token.then(_token => {
      let headers: HttpHeaders = new HttpHeaders();
      headers = headers.set("Authorization", "Bearer " + _token);
      const flairsEndpoint = new URL("/flairs", environment.api).toString();
      this.http.get<Map<string, Flair>>(flairsEndpoint, { headers: headers })
        .subscribe({
          next: flairs => {
            this.flairs.set(flairs);
            if (this.data.subject?.id) {
              this.bindSubject(this.data.subject);
              this.isLoading.set(false);
            } else if (!this.create) {
              const episodeEndpoint = new URL(`/subject/${encodeURIComponent(this.subjectName!)}`, environment.api).toString();
              this.http.get<SubjectResponse>(episodeEndpoint, { headers: headers })
                .subscribe(
                  {
                    next: resp => {
                      this.bindSubject(resp);
                      this.isLoading.set(false);
                    },
                    error: e => {
                      this.isLoading.set(false);
                      this.isInError.set(true);
                    }
                  }
                )
            } else {
              this.originalSubject = {};
              this.form.set(new FormGroup<SubjectForm>({
                name: new FormControl(""!, { nonNullable: true }),
                aliases: new FormControl([], { nonNullable: false }),
                associatedSubjects: new FormControl([], { nonNullable: false }),
                subjectType: new FormControl(SubjectType[SubjectType.Unset], { nonNullable: true }),
                enrichmentHashTags: new FormControl([], { nonNullable: false }),
                hashTag: new FormControl("", { nonNullable: false, validators: [hashPrefixedTagValidator()] }),
                redditFlairTemplateId: new FormControl("", { nonNullable: false }),
                redditFlareText: new FormControl("", { nonNullable: false }),
                knownTerms: new FormControl<string[]>([], { nonNullable: true })
              }));
              this.isLoading.set(false);
            }
          },
          error: () => {
            if (this.data.subject?.id) {
              this.bindSubject(this.data.subject);
              this.isLoading.set(false);
              return;
            }
            this.isLoading.set(false);
            this.isInError.set(true);
          }
        })
    }).catch(() => {
      if (this.data.subject?.id) {
        this.bindSubject(this.data.subject);
        this.isLoading.set(false);
        return;
      }
      this.isLoading.set(false);
      this.isInError.set(true);
    });
  }

  private bindSubject(resp: SubjectResponse) {
    this.subjectId = resp.id ?? undefined;
    this.subjectName = resp.name ?? this.subjectName;
    this.originalSubject = resp;
    this.form.set(new FormGroup<SubjectForm>({
      name: new FormControl(resp.name!, { nonNullable: true }),
      aliases: new FormControl(resp.aliases, { nonNullable: false }),
      associatedSubjects: new FormControl(resp.associatedSubjects, { nonNullable: false }),
      subjectType: new FormControl(resp.subjectType ?? SubjectType[SubjectType.Unset], { nonNullable: true }),
      enrichmentHashTags: new FormControl(resp.enrichmentHashTags, { nonNullable: false }),
      hashTag: new FormControl(ensureHashPrefix(resp.hashTag), { nonNullable: false, validators: [hashPrefixedTagValidator()] }),
      redditFlairTemplateId: new FormControl(resp.redditFlairTemplateId, { nonNullable: false }),
      redditFlareText: new FormControl(resp.redditFlareText, { nonNullable: false }),
      knownTerms: new FormControl<string[]>(resp.knownTerms ?? [], { nonNullable: true })
    }));
  }

  close() {
    if (this.conflict) {
      this.dialogRef.close({ conflict: this.conflict });

    } else {
      this.dialogRef.close({ closed: true });
    }
  }

  normalizeHashTag() {
    const control = this.form()?.controls.hashTag;
    if (control) {
      normalizeHashTagControl(control);
    }
  }

  onSubmit() {
    const form = this.form();
    if (form?.valid) {
      const update: SubjectEntity = {
        aliases: asStringArray(form.controls.aliases.value),
        associatedSubjects: asStringArray(form.controls.associatedSubjects.value),
        enrichmentHashTags: asStringArray(form.controls.enrichmentHashTags.value),
        hashTag: asEmptyString(form.controls.hashTag.value),
        redditFlairTemplateId: emptyGuidIfBlank(form.controls.redditFlairTemplateId.value),
        redditFlareText: asEmptyString(form.controls.redditFlareText.value),
        subjectType: form.controls.subjectType.value,
        knownTerms: asStringArray(form.controls.knownTerms.value)
      };

      if (this.create) {
        update.name = asEmptyString(form.controls.name.value);
      }

      var changes = this.getChanges(this.originalSubject!, update);
      if (Object.keys(changes).length == 0) {
        this.dialogRef.close({ noChange: true });
      } else {
        this.send(this.subjectId!, changes);
      }
    }
  }

  isSameA(a: string[] | null | undefined, b: string[] | null | undefined): boolean {
    if (!a && !b) {
      return true;
    }
    if (!a && b?.length == 0) {
      return true;
    }
    if (a?.length == 0 && !b) {
      return true;
    }
    return JSON.stringify(a) == JSON.stringify(b);
  }

  isSame(a: string | null | undefined, b: string | null | undefined): boolean {
    if (!a && !b) {
      return true;
    }
    return JSON.stringify(a) == JSON.stringify(b);
  }

  getChanges(prev: SubjectResponse | SubjectEntity, now: SubjectEntity): SubjectEntity {
    var changes: SubjectEntity = {};
    if (this.create) changes.name = now.name;
    if (!this.isSameA(prev.aliases, now.aliases)) changes.aliases = now.aliases;
    if (!this.isSameA(prev.associatedSubjects, now.associatedSubjects)) changes.associatedSubjects = now.associatedSubjects;
    if (!this.isSameA(prev.enrichmentHashTags, now.enrichmentHashTags)) changes.enrichmentHashTags = now.enrichmentHashTags;
    if (!this.isSame(prev.hashTag, now.hashTag)) changes.hashTag = now.hashTag;
    if (!this.isSame(prev.redditFlairTemplateId, now.redditFlairTemplateId)) changes.redditFlairTemplateId = now.redditFlairTemplateId;
    if (!this.isSame(prev.redditFlareText, now.redditFlareText)) changes.redditFlareText = now.redditFlareText;
    if ((prev.subjectType ?? SubjectType[SubjectType.Unset].toString()) != now.subjectType?.toString()) changes.subjectType = now.subjectType;
    if (!this.isSameA(prev.knownTerms, now.knownTerms)) changes.knownTerms = now.knownTerms;
    return changes;
  }

  send(id: string, changes: SubjectEntity) {
    const dialogRef = this.dialog.open<EditSubjectSendComponent, { create: boolean }, EditSubjectSendResult>(
      EditSubjectSendComponent,
      { disableClose: true, autoFocus: true, data: { create: this.create } }
    );
    dialogRef.componentInstance.submit(id, changes, this.create);
    dialogRef.afterClosed().subscribe(async result => {
      if (result?.updated) {
        this.dialogRef.close({
          updated: true,
          subjectName: result.subject?.name ?? changes.name,
          subject: result.subject
        });
      } else if (result?.conflict) {
        this.conflict = result.conflict;
      }
    });
  }

  styleOption(flair: Flair): string {
    return `background-color: ${flair.backgroundColour}; color:${flair.textColour == 'dark' ? 'black' : 'white'}`;
  }

  styleSelect(): string {
    const currentFlairId = this.form()!.controls.redditFlairTemplateId.value;
    if (currentFlairId) {
      const anyFlair: any = this.flairs();
      const flair = anyFlair[currentFlairId];
      if (flair) {
        return `background-color: ${flair.backgroundColour}; color:${flair.textColour == 'dark' ? 'black' : 'white'}`;
      }
    }
    return "";
  }
}
